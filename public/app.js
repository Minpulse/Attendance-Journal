// Состояние журнала в оперативной памяти браузера
let state = {
    dates: [],
    students: [],
};

const STATUS_CYCLE = ["", "П", "Н", "У", "О"];
const SESSION_KEY = "journal_pass";

// Узлы DOM
const thead = document.getElementById("journalThead");
const tbody = document.getElementById("journalTbody");
const authBtn = document.getElementById("authBtn");
const roleBadge = document.getElementById("roleBadge");
const adminControls = document.getElementById("adminControls");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const lowAttendanceFilter = document.getElementById("lowAttendanceFilter");

// Работа с паролем в sessionStorage
const getPassword = () => sessionStorage.getItem(SESSION_KEY);
const isAdmin = () => Boolean(getPassword());

// Универсальная функция для HTTP-запросов через Fetch API
async function apiRequest(url, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };
    const pass = getPassword();
    if (pass) {
        headers["x-auth-password"] = pass;
    }

    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
        sessionStorage.removeItem(SESSION_KEY);
        updateAuthUI();
        throw new Error("Неверный пароль преподавателя или сессия истекла");
    }
    if (!response.ok) {
        throw new Error(data.error || "Ошибка HTTP-запроса");
    }
    return data;
}

// Переключение интерфейса между режимом просмотра и режимом преподавателя
function updateAuthUI() {
    if (isAdmin()) {
        roleBadge.textContent = "Режим преподавателя";
        roleBadge.className = "badge badge--admin";
        authBtn.textContent = "Выйти";
        adminControls.classList.remove("hidden");
    } else {
        roleBadge.textContent = "Режим просмотра";
        roleBadge.className = "badge badge--readonly";
        authBtn.textContent = "Войти как преподаватель";
        adminControls.classList.add("hidden");
    }
    renderJournal();
}

// Подсчет пропусков и процента посещаемости студента
function calculateStats(student) {
    let presentCount = 0;
    let absentUnexcused = 0;
    let absentExcused = 0;
    let totalMarked = 0;

    state.dates.forEach((date) => {
        const status = student.attendance[date] || "";
        if (status !== "") totalMarked++;
        if (status === "П" || status === "О") presentCount++;
        if (status === "Н") absentUnexcused++;
        if (status === "У") absentExcused++;
    });

    const attendanceRate =
        totalMarked === 0
            ? 100
            : Math.floor((presentCount / totalMarked) * 100);

    return { presentCount, absentUnexcused, absentExcused, attendanceRate };
}

// Динамическая отрисовка таблицы через DOM API
function renderJournal() {
    const admin = isAdmin();

    // 1. Шапка таблицы (thead)
    thead.innerHTML = "";
    const headRow = document.createElement("tr");

    const thStudent = document.createElement("th");
    thStudent.textContent = "Студент / Группа";
    headRow.appendChild(thStudent);

    state.dates.forEach((date) => {
        const th = document.createElement("th");
        th.textContent = date;
        if (admin) {
            const delBtn = document.createElement("button");
            delBtn.className = "del-date-btn";
            delBtn.textContent = "×";
            delBtn.title = `Удалить дату ${date}`;
            delBtn.dataset.deleteDate = date;
            th.appendChild(delBtn);
        }
        headRow.appendChild(th);
    });

    ["Прис.", "Н (неув.)", "У (ув.)", "% пос."].forEach((label) => {
        const th = document.createElement("th");
        th.textContent = label;
        headRow.appendChild(th);
    });

    if (admin) {
        const thAction = document.createElement("th");
        thAction.textContent = "Действие";
        headRow.appendChild(thAction);
    }
    thead.appendChild(headRow);

    // 2. Фильтрация и сортировка массива студентов
    const query = searchInput.value.trim().toLowerCase();
    const onlyRisk = lowAttendanceFilter.checked;
    const sortBy = sortSelect.value;

    let processed = state.students.map((student) => ({
        ...student,
        stats: calculateStats(student),
    }));

    if (query) {
        processed = processed.filter((s) =>
            s.fullName.toLowerCase().includes(query),
        );
    }
    if (onlyRisk) {
        processed = processed.filter((s) => s.stats.attendanceRate < 80);
    }

    if (sortBy === "name_asc") {
        processed.sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));
    } else if (sortBy === "absences_desc") {
        processed.sort(
            (a, b) => b.stats.absentUnexcused - a.stats.absentUnexcused,
        );
    } else if (sortBy === "rate_asc") {
        processed.sort(
            (a, b) => a.stats.attendanceRate - b.stats.attendanceRate,
        );
    }

    // 3. Тело таблицы через DocumentFragment
    tbody.innerHTML = "";
    const fragment = document.createDocumentFragment();

    processed.forEach((student) => {
        const tr = document.createElement("tr");

        const tdName = document.createElement("td");
        tdName.innerHTML = `<strong>${student.fullName}</strong><br><small style="color:#64748b">${student.group}</small>`;
        tr.appendChild(tdName);

        state.dates.forEach((date) => {
            const td = document.createElement("td");
            const currentStatus = student.attendance[date] || "";
            td.textContent = currentStatus;
            td.className = `att-cell ${currentStatus ? "status-" + currentStatus : ""} ${admin ? "att-cell--editable" : ""}`;
            td.dataset.studentId = student.id;
            td.dataset.date = date;
            tr.appendChild(td);
        });

        const { presentCount, absentUnexcused, absentExcused, attendanceRate } =
            student.stats;

        const tdPresent = document.createElement("td");
        tdPresent.textContent = presentCount;
        tr.appendChild(tdPresent);

        const tdUnexcused = document.createElement("td");
        tdUnexcused.textContent = absentUnexcused;
        tr.appendChild(tdUnexcused);

        const tdExcused = document.createElement("td");
        tdExcused.textContent = absentExcused;
        tr.appendChild(tdExcused);

        const tdRate = document.createElement("td");
        tdRate.textContent = `${attendanceRate}%`;
        tdRate.className = attendanceRate < 80 ? "rate-low" : "rate-ok";
        tr.appendChild(tdRate);

        if (admin) {
            const tdDel = document.createElement("td");
            const btn = document.createElement("button");
            btn.className = "btn btn--danger";
            btn.textContent = "Удалить";
            btn.dataset.deleteStudent = student.id;
            tdDel.appendChild(btn);
            tr.appendChild(tdDel);
        }

        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
    updateTopSummary();
}

// Обновление верхней сводной статистики
function updateTopSummary() {
    document.getElementById("totalStudentsCount").textContent =
        state.students.length;
    document.getElementById("totalDatesCount").textContent = state.dates.length;

    if (state.students.length === 0) {
        document.getElementById("avgAttendanceRate").textContent = "0%";
        return;
    }

    const sumRates = state.students.reduce(
        (acc, s) => acc + calculateStats(s).attendanceRate,
        0,
    );
    const avg = Math.floor(sumRates / state.students.length);
    document.getElementById("avgAttendanceRate").textContent = `${avg}%`;
}
// Загрузка журнала с сервера
async function loadJournal() {
    try {
        state = await apiRequest("/api/journal");
        renderJournal();
    } catch (err) {
        alert(err.message);
    }
}

// Авторизация преподавателя
authBtn.addEventListener("click", async () => {
    if (isAdmin()) {
        sessionStorage.removeItem(SESSION_KEY);
        updateAuthUI();
        return;
    }
    const pass = prompt("Введите пароль преподавателя (по умолчанию 1234):");
    if (!pass) return;

    sessionStorage.setItem(SESSION_KEY, pass);
    try {
        await apiRequest("/api/auth", { method: "POST" });
        updateAuthUI();
    } catch (err) {
        alert(err.message);
    }
});

// Добавление нового студента
document
    .getElementById("addStudentForm")
    .addEventListener("submit", async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById("studentNameInput");
        const groupInput = document.getElementById("studentGroupInput");

        try {
            const created = await apiRequest("/api/students", {
                method: "POST",
                body: JSON.stringify({
                    fullName: nameInput.value,
                    group: groupInput.value,
                }),
            });
            state.students.push(created);
            nameInput.value = "";
            renderJournal();
        } catch (err) {
            alert(err.message);
        }
    });

// Добавление новой даты занятия
document.getElementById("addDateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const dateInput = document.getElementById("dateInput");

    try {
        const res = await apiRequest("/api/dates", {
            method: "POST",
            body: JSON.stringify({ date: dateInput.value }),
        });
        state.dates.push(res.date);
        dateInput.value = "";
        renderJournal();
    } catch (err) {
        alert(err.message);
    }
});

// Делегирование кликов в шапке таблицы (удаление даты)
thead.addEventListener("click", async (e) => {
    const dateToDelete = e.target.dataset.deleteDate;
    if (!dateToDelete || !isAdmin()) return;

    if (!confirm(`Удалить занятие за ${dateToDelete}?`)) return;
    try {
        await apiRequest(`/api/dates/${encodeURIComponent(dateToDelete)}`, {
            method: "DELETE",
        });
        state.dates = state.dates.filter((d) => d !== dateToDelete);
        state.students.forEach((s) => delete s.attendance[dateToDelete]);
        renderJournal();
    } catch (err) {
        alert(err.message);
    }
});

// Делегирование кликов в теле таблицы (смена статуса или удаление студента)
tbody.addEventListener("click", async (e) => {
    if (!isAdmin()) return;

    const studentToDelete = e.target.dataset.deleteStudent;
    if (studentToDelete) {
        if (!confirm("Удалить студента из журнала?")) return;
        try {
            await apiRequest(`/api/students/${studentToDelete}`, {
                method: "DELETE",
            });
            state.students = state.students.filter(
                (s) => s.id !== studentToDelete,
            );
            renderJournal();
        } catch (err) {
            alert(err.message);
        }
        return;
    }

    const cell = e.target.closest(".att-cell");
    if (!cell) return;

    const { studentId, date } = cell.dataset;
    const student = state.students.find((s) => s.id === studentId);
    if (!student) return;

    const currentStatus = student.attendance[date] || "";
    const nextIndex =
        (STATUS_CYCLE.indexOf(currentStatus) + 1) % STATUS_CYCLE.length;
    const nextStatus = STATUS_CYCLE[nextIndex];

    if (nextStatus === "") {
        delete student.attendance[date];
    } else {
        student.attendance[date] = nextStatus;
    }
    renderJournal();

    try {
        await apiRequest("/api/attendance", {
            method: "PATCH",
            body: JSON.stringify({ studentId, date, status: nextStatus }),
        });
    } catch (err) {
        alert(err.message);
        await loadJournal();
    }
});

// Поиск, сортировка и фильтрация
searchInput.addEventListener("input", renderJournal);
sortSelect.addEventListener("change", renderJournal);
lowAttendanceFilter.addEventListener("change", renderJournal);

// Интерактивный градиент заголовка под курсором мыши
const brandTitle = document.getElementById("brandTitle");
if (brandTitle) {
    brandTitle.addEventListener("mousemove", (e) => {
        const rect = brandTitle.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        brandTitle.style.setProperty("--x", `${x}px`);
        brandTitle.style.setProperty("--y", `${y}px`);
    });

    brandTitle.addEventListener("mouseleave", () => {
        brandTitle.style.setProperty("--x", "50%");
        brandTitle.style.setProperty("--y", "50%");
    });
}

// Запуск при открытии страницы
updateAuthUI();
loadJournal();
