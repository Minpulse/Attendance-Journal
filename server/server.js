const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const ADMIN_PASSWORD = '7777';
const DATA_FILE = path.join(__dirname, 'journal.json');
const ALLOWED_STATUSES = ['П', 'Н', 'У', 'О', ''];

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const DEFAULT_JOURNAL = {
    dates: ['10.11', '12.11'],
    students: []
};

async function readJournal() {
    try {
        if (!fsSync.existsSync(DATA_FILE)) {
            await writeJournal(DEFAULT_JOURNAL);
            return structuredClone(DEFAULT_JOURNAL);
        }
        const raw = await fs.readFile(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.dates) || !Array.isArray(parsed.students)) {
            throw new Error('Некорректная структура файла');
        }
        return parsed;
    } catch (err) {
        console.error('Ошибка чтения journal.json, восстановление структуры:', err.message);
        await writeJournal(DEFAULT_JOURNAL);
        return structuredClone(DEFAULT_JOURNAL);
    }
}

async function writeJournal(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 4), 'utf-8');
}

function checkAuth(req, res, next) {
    const password = req.headers['x-auth-password'];
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Ошибка авторизации: неверный пароль преподавателя' });
    }
    next();
}

app.get('/api/journal', async (req, res) => {
    const journal = await readJournal();
    res.status(200).json(journal);
});

app.post('/api/auth', checkAuth, (req, res) => {
    res.status(200).json({ status: 'authorized' });
});

app.post('/api/students', checkAuth, async (req, res) => {
    const { fullName, group } = req.body;
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 3) {
        return res.status(400).json({ error: 'Введите корректное ФИО студента' });
    }
    const journal = await readJournal();
    const newStudent = {
        id: Date.now().toString(),
        fullName: fullName.trim(),
        group: (group && group.trim()) ? group.trim() : 'Без группы',
        attendance: {}
    };
    journal.students.push(newStudent);
    await writeJournal(journal);
    res.status(201).json(newStudent);
});

app.delete('/api/students/:id', checkAuth, async (req, res) => {
    const { id } = req.params;
    const journal = await readJournal();
    const initialLength = journal.students.length;
    journal.students = journal.students.filter(student => student.id !== id);
    if (journal.students.length === initialLength) {
        return res.status(404).json({ error: 'Студент с указанным ID не найден' });
    }
    await writeJournal(journal);
    res.status(200).json({ status: 'deleted', id });
});

app.post('/api/dates', checkAuth, async (req, res) => {
    const { date } = req.body;
    const dateRegex = /^\d{2}\.\d{2}$/;
    if (!date || !dateRegex.test(date.trim())) {
        return res.status(400).json({ error: 'Дата должна быть в формате ДД.ММ (например, 25.11)' });
    }
    const cleanDate = date.trim();
    const journal = await readJournal();
    if (journal.dates.includes(cleanDate)) {
        return res.status(400).json({ error: 'Такая дата уже есть в журнале' });
    }
    journal.dates.push(cleanDate);
    await writeJournal(journal);
    res.status(201).json({ status: 'created', date: cleanDate });
});

app.delete('/api/dates/:date', checkAuth, async (req, res) => {
    const { date } = req.params;
    const journal = await readJournal();
    if (!journal.dates.includes(date)) {
        return res.status(404).json({ error: 'Дата не найдена' });
    }
    journal.dates = journal.dates.filter(d => d !== date);
    journal.students.forEach(student => {
        delete student.attendance[date];
    });
    await writeJournal(journal);
    res.status(200).json({ status: 'deleted', date });
});

app.patch('/api/attendance', checkAuth, async (req, res) => {
    const { studentId, date, status } = req.body;
    if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Недопустимый код статуса посещаемости' });
    }
    const journal = await readJournal();
    const student = journal.students.find(s => s.id === studentId);
    if (!student) {
        return res.status(404).json({ error: 'Студент не найден' });
    }
    if (!journal.dates.includes(date)) {
        return res.status(404).json({ error: 'Указанная дата отсутствует в журнале' });
    }
    if (status === '') {
        delete student.attendance[date];
    } else {
        student.attendance[date] = status;
    }
    await writeJournal(journal);
    res.status(200).json({ status: 'updated', studentId, date, value: status });
});

app.listen(PORT, () => {
    console.log(`Сервер «Электронный журнал посещаемости» запущен: http://localhost:${PORT}`);
});
