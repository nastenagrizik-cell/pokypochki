const state = {
  projects: [],
  meta: { units: [] },
  currentProjectId: null
};

const elements = {
  projectsList: document.getElementById('projects-list'),
  overview: document.getElementById('project-overview'),
  participantsList: document.getElementById('participants-list'),
  itemsList: document.getElementById('items-list'),
  unitSelect: document.getElementById('unit-select'),
  createdBySelect: document.getElementById('created-by-select'),
  assignedToSelect: document.getElementById('assigned-to-select'),
  participantForm: document.getElementById('participant-form'),
  participantName: document.getElementById('participant-name'),
  itemForm: document.getElementById('item-form'),
  projectForm: document.getElementById('project-form'),
  projectModal: document.getElementById('project-modal'),
  openProjectModal: document.getElementById('open-project-modal'),
  closeProjectModal: document.getElementById('close-project-modal'),
  themeToggle: document.querySelector('[data-theme-toggle]')
};

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Ошибка запроса');
  }
  return response.json();
}

function getCurrentProject() {
  return state.projects.find((project) => project.id === state.currentProjectId) || state.projects[0] || null;
}

function renderProjects() {
  elements.projectsList.innerHTML = '';
  state.projects.forEach((project) => {
    const card = document.createElement('div');
    card.className = `project-card ${project.id === state.currentProjectId ? 'active' : ''}`;
    card.innerHTML = `
      <button type="button" data-project-id="${project.id}">
        <strong>${project.name}</strong>
        <p class="muted">${project.description || 'Без описания'}</p>
        <p class="muted">${project.stats.completed}/${project.stats.total} куплено · ${project.stats.totalSpent} ₽</p>
      </button>
    `;
    card.querySelector('button').addEventListener('click', () => {
      state.currentProjectId = project.id;
      renderAll();
    });
    elements.projectsList.appendChild(card);
  });
}

function renderOverview(project) {
  if (!project) {
    elements.overview.innerHTML = '<div class="empty-state">Сначала создайте проект.</div>';
    return;
  }

  elements.overview.innerHTML = `
    <div>
      <p class="eyebrow">Текущий проект</p>
      <h2>${project.name}</h2>
      <p class="muted">${project.description || 'Добавьте описание проекта, чтобы участникам было понятнее.'}</p>
    </div>
    <div class="progress-line"><span style="width:${project.stats.progress}%"></span></div>
    <div class="stats-grid">
      <div class="stat-card"><p class="muted">Прогресс</p><h3>${project.stats.progress}%</h3></div>
      <div class="stat-card"><p class="muted">Всего позиций</p><h3>${project.stats.total}</h3></div>
      <div class="stat-card"><p class="muted">Куплено</p><h3>${project.stats.completed}</h3></div>
      <div class="stat-card"><p class="muted">Сумма</p><h3>${project.stats.totalSpent} ₽</h3></div>
    </div>
  `;
}

function populateParticipantSelects(project) {
  const options = project ? project.participants : [];
  elements.createdBySelect.innerHTML = '<option value="">Кто добавляет</option>';
  elements.assignedToSelect.innerHTML = '<option value="">Не назначено</option>';

  options.forEach((person) => {
    const optionA = document.createElement('option');
    optionA.value = person.id;
    optionA.textContent = person.name;
    elements.createdBySelect.appendChild(optionA);

    const optionB = document.createElement('option');
    optionB.value = person.id;
    optionB.textContent = person.name;
    elements.assignedToSelect.appendChild(optionB);
  });
}

function renderParticipants(project) {
  elements.participantsList.innerHTML = '';
  if (!project || !project.participants.length) {
    elements.participantsList.innerHTML = '<div class="empty-state">Добавьте первого участника.</div>';
    return;
  }

  project.participants.forEach((person) => {
    const assignedCount = project.items.filter((item) => item.assignedTo === person.id).length;
    const doneCount = project.items.filter((item) => item.assignedTo === person.id && item.status === 'done').length;
    const card = document.createElement('div');
    card.className = 'participant-card';
    card.innerHTML = `
      <div class="item-card-top">
        <strong><span class="avatar" style="background:${person.color}"></span> ${person.name}</strong>
        <span class="badge">${assignedCount} поз.</span>
      </div>
      <p class="muted">Куплено: ${doneCount}</p>
    `;
    elements.participantsList.appendChild(card);
  });
}

function statusBadge(item) {
  if (item.status === 'done') return '<span class="badge success">Куплено</span>';
  if (item.status === 'assigned') return '<span class="badge">Назначено</span>';
  if (item.status === 'cancelled') return '<span class="badge warning">Отменено</span>';
  return '<span class="badge warning">Не назначено</span>';
}

function personName(project, id) {
  return project.participants.find((person) => person.id === id)?.name || '—';
}

function renderItems(project) {
  elements.itemsList.innerHTML = '';
  if (!project || !project.items.length) {
    elements.itemsList.innerHTML = '<div class="empty-state">Пока нет ни одной покупки.</div>';
    return;
  }

  project.items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-card-top">
        <div>
          <strong>${item.title}</strong>
          <p class="muted">${item.quantity} ${item.unit}${item.comment ? ` · ${item.comment}` : ''}</p>
        </div>
        ${statusBadge(item)}
      </div>
      <div class="item-card-meta">
        <span class="muted">Добавил: ${personName(project, item.createdBy)}</span>
        <span class="muted">Ответственный: ${item.assignedTo ? personName(project, item.assignedTo) : 'не назначен'}</span>
        <span class="muted">Цена: ${item.price ? `${item.price} ₽` : 'не указана'}</span>
      </div>
      <div class="item-card-actions">
        <select data-action="assign">
          <option value="">Назначить участника</option>
          ${project.participants.map((person) => `<option value="${person.id}" ${item.assignedTo === person.id ? 'selected' : ''}>${person.name}</option>`).join('')}
        </select>
        <input data-action="price" type="number" min="0" placeholder="Цена" value="${item.price ?? ''}" />
        <button class="btn btn-secondary" data-action="take-self" type="button">Взять себе</button>
        <button class="btn btn-primary" data-action="done" type="button">Отметить купленным</button>
      </div>
    `;

    const assignSelect = card.querySelector('[data-action="assign"]');
    const priceInput = card.querySelector('[data-action="price"]');
    const takeSelfBtn = card.querySelector('[data-action="take-self"]');
    const doneBtn = card.querySelector('[data-action="done"]');

    assignSelect.addEventListener('change', async (event) => {
      await updateItem(project.id, item.id, { assignedTo: event.target.value || null });
    });

    priceInput.addEventListener('change', async (event) => {
      await updateItem(project.id, item.id, { price: event.target.value || null });
    });

    takeSelfBtn.addEventListener('click', async () => {
      const firstParticipant = project.participants[0];
      if (!firstParticipant) {
        alert('Сначала добавьте участника.');
        return;
      }
      await updateItem(project.id, item.id, { assignedTo: firstParticipant.id });
    });

    doneBtn.addEventListener('click', async () => {
      await updateItem(project.id, item.id, { status: 'done' });
    });

    elements.itemsList.appendChild(card);
  });
}

function renderAll() {
  const project = getCurrentProject();
  renderProjects();
  renderOverview(project);
  populateParticipantSelects(project);
  renderParticipants(project);
  renderItems(project);
}

async function refreshProjects() {
  state.projects = await request('/api/projects');
  if (!state.currentProjectId && state.projects.length) {
    state.currentProjectId = state.projects[0].id;
  }
  renderAll();
}

async function updateItem(projectId, itemId, payload) {
  const updatedProject = await request(`/api/projects/${projectId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
  state.projects = state.projects.map((project) => project.id === updatedProject.id ? updatedProject : project);
  renderAll();
}

async function init() {
  state.meta = await request('/api/meta');
  elements.unitSelect.innerHTML = state.meta.units.map((unit) => `<option value="${unit}">${unit}</option>`).join('');
  await refreshProjects();

  elements.participantForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const project = getCurrentProject();
    if (!project) return;
    const name = elements.participantName.value.trim();
    if (!name) return;
    const updatedProject = await request(`/api/projects/${project.id}/participants`, {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    state.projects = state.projects.map((entry) => entry.id === updatedProject.id ? updatedProject : entry);
    elements.participantForm.reset();
    renderAll();
  });

  elements.itemForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const project = getCurrentProject();
    if (!project) return;
    const formData = new FormData(elements.itemForm);
    const payload = Object.fromEntries(formData.entries());
    const updatedProject = await request(`/api/projects/${project.id}/items`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.projects = state.projects.map((entry) => entry.id === updatedProject.id ? updatedProject : entry);
    elements.itemForm.reset();
    elements.unitSelect.value = state.meta.units[0] || 'шт';
    renderAll();
  });

  elements.projectForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(elements.projectForm);
    const payload = Object.fromEntries(formData.entries());
    const project = await request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.projects.unshift(project);
    state.currentProjectId = project.id;
    elements.projectForm.reset();
    elements.projectModal.close();
    renderAll();
  });

  elements.openProjectModal.addEventListener('click', () => elements.projectModal.showModal());
  elements.closeProjectModal.addEventListener('click', () => elements.projectModal.close());

  let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  elements.themeToggle.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  });

  setInterval(refreshProjects, 15000);
}

init().catch((error) => {
  console.error(error);
  alert(error.message || 'Ошибка загрузки приложения');
});
