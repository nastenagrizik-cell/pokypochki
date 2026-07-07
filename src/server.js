const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const units = ['шт', 'кг', 'г', 'л', 'мл', 'уп', 'бутылка', 'пачка'];

const store = {
  projects: [
    {
      id: 'project-1',
      name: 'Закупка на пикник',
      description: 'Черновой пример проекта для совместных покупок',
      createdAt: new Date().toISOString(),
      participants: [
        { id: 'user-1', name: 'Анастасия', color: '#01696f' },
        { id: 'user-2', name: 'Ира', color: '#437a22' },
        { id: 'user-3', name: 'Дима', color: '#da7101' }
      ],
      items: [
        {
          id: 'item-1',
          title: 'Сок',
          quantity: 2,
          unit: 'л',
          comment: 'Апельсиновый',
          createdBy: 'user-1',
          assignedTo: 'user-2',
          status: 'assigned',
          price: null,
          updatedAt: new Date().toISOString()
        },
        {
          id: 'item-2',
          title: 'Уголь',
          quantity: 1,
          unit: 'уп',
          comment: '',
          createdBy: 'user-2',
          assignedTo: null,
          status: 'open',
          price: null,
          updatedAt: new Date().toISOString()
        },
        {
          id: 'item-3',
          title: 'Овощи',
          quantity: 3,
          unit: 'кг',
          comment: '',
          createdBy: 'user-3',
          assignedTo: 'user-3',
          status: 'done',
          price: 780,
          updatedAt: new Date().toISOString()
        }
      ]
    }
  ]
};

function findProject(id) {
  return store.projects.find((project) => project.id === id);
}

function serializeProject(project) {
  const total = project.items.length;
  const completed = project.items.filter((item) => item.status === 'done').length;
  const open = project.items.filter((item) => item.status === 'open').length;
  const assigned = project.items.filter((item) => item.status === 'assigned').length;
  const totalSpent = project.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

  return {
    ...project,
    stats: {
      total,
      completed,
      open,
      assigned,
      progress: total ? Math.round((completed / total) * 100) : 0,
      totalSpent
    }
  };
}

app.get('/api/meta', (req, res) => {
  res.json({
    units,
    statuses: [
      { value: 'open', label: 'Не назначено' },
      { value: 'assigned', label: 'Назначено' },
      { value: 'done', label: 'Куплено' },
      { value: 'cancelled', label: 'Отменено' }
    ]
  });
});

app.get('/api/projects', (req, res) => {
  res.json(store.projects.map(serializeProject));
});

app.post('/api/projects', (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Название проекта обязательно.' });
  }

  const project = {
    id: `project-${Date.now()}`,
    name: name.trim(),
    description: (description || '').trim(),
    createdAt: new Date().toISOString(),
    participants: [],
    items: []
  };

  store.projects.unshift(project);
  res.status(201).json(serializeProject(project));
});

app.post('/api/projects/:projectId/participants', (req, res) => {
  const project = findProject(req.params.projectId);
  if (!project) {
    return res.status(404).json({ error: 'Проект не найден.' });
  }

  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Имя участника обязательно.' });
  }

  const participant = {
    id: `user-${Date.now()}`,
    name: name.trim(),
    color: ['#01696f', '#437a22', '#da7101', '#7a39bb', '#006494'][project.participants.length % 5]
  };

  project.participants.push(participant);
  res.status(201).json(serializeProject(project));
});

app.post('/api/projects/:projectId/items', (req, res) => {
  const project = findProject(req.params.projectId);
  if (!project) {
    return res.status(404).json({ error: 'Проект не найден.' });
  }

  const { title, quantity, unit, comment, createdBy, assignedTo } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Название покупки обязательно.' });
  }

  const item = {
    id: `item-${Date.now()}`,
    title: title.trim(),
    quantity: Number(quantity) || 1,
    unit: units.includes(unit) ? unit : 'шт',
    comment: (comment || '').trim(),
    createdBy: createdBy || null,
    assignedTo: assignedTo || null,
    status: assignedTo ? 'assigned' : 'open',
    price: null,
    updatedAt: new Date().toISOString()
  };

  project.items.unshift(item);
  res.status(201).json(serializeProject(project));
});

app.patch('/api/projects/:projectId/items/:itemId', (req, res) => {
  const project = findProject(req.params.projectId);
  if (!project) {
    return res.status(404).json({ error: 'Проект не найден.' });
  }

  const item = project.items.find((entry) => entry.id === req.params.itemId);
  if (!item) {
    return res.status(404).json({ error: 'Позиция не найдена.' });
  }

  const { assignedTo, status, price } = req.body;
  if (assignedTo !== undefined) {
    item.assignedTo = assignedTo || null;
    if (!item.assignedTo && item.status !== 'done' && item.status !== 'cancelled') {
      item.status = 'open';
    }
    if (item.assignedTo && item.status === 'open') {
      item.status = 'assigned';
    }
  }

  if (status) {
    item.status = status;
  }

  if (price !== undefined) {
    item.price = price === null || price === '' ? null : Number(price);
  }

  item.updatedAt = new Date().toISOString();
  res.json(serializeProject(project));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
