const state = {
  projects: [],
  meta: { units: [] },
  currentProjectId: null,
  participantsExpanded: false,
  projectsExpanded: false
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
  themeToggle: document.querySelector('[data-theme-toggle]'),
  toggleProjects: document.getElementById('toggle-projects'),
  toggleParticipants: document.getElementById('toggle-participants'),
  projectsDrawer: document.getElementById('projects-drawer'),
  participantsPanel: document.getElementById('participants-panel'),
  currentProjectName: document.getElementById('current-project-name')
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

function personName(project, id) {
  return project.participants.find((person) => person.id === id)?.name || '—';
}

function statusBadge(item) {
  if (item.status === 'done') return '<span class="badge success">Куплено</span>';
  if (item.status === 'assigned') return '<span class="badge">Назначено</span>';
  if (item.status === 'cancelled') return '<span class="badge warning">Отменено</span>';
  return '<span class="badge warning">Свободно</span>';
}

function renderProjects() {
  elements.projectsList.innerHTML = '';
  if (!state.projects.length) {
    elements.projectsList.innerHTML = '<div class="empty-state">Пока нет проектов.</div>';
    return;
  }
  state.projects.forEach((project) => {
    const card = document.createElement('div');
    card.className = `project-card ${project.id === state.currentProjectId ? 'active' : ''}`;
    card.innerHTML = `
      <button type="button" data-project-id="${project.id}">
        <strong>${project.name}</strong>
        <p>${project.stats.completed}/${project.stats.total} · ${project.stats.totalSpent} ₽</p>
      </button>
    `;
    card.querySelector('button').addEventListener('click', () => {
      state.currentProjectId = project.id;
      state.projectsExpanded = false;
      syncPanels();
      renderAll();
    });
    elements.projectsList.appendChild(card);
  });
}

function renderOverview(project) {
  if (!project) {
    elements.overview.innerHTML = '<div class="empty-state">Создай первый проект.</div>';
    elements.currentProjectName.textContent = 'Нет активного проекта';
    return;
  }
  elements.currentProjectName.textContent = project.name;
  elements.overview.innerHTML = `
    <div>
      <h2>${project.name}</h2>
      <p class="muted">${project.description || 'Без описания'}</p>
    </div>
    <div class="project-summary-line">
      <span class="kpi-chip">Прогресс: ${project.stats.progress}%</span>
      <span class="kpi-chip">Покупок: ${project.stats.total}</span>
      <span class="kpi-chip">Куплено: ${project.stats.completed}</span>
      <span class="kpi-chip">Сумма: ${project.stats.totalSpent} ₽</span>
    </div>
    <div class="progress-line"><span style="width:${project.stats.progress}%"></span></div>
  `;
}

function populateParticipantSelects(project) {
  const options = project ? project.participants : [];
  elements.createdBySelect.innerHTML = '<option value="">Кто добавил</option>';
  elements.assignedToSelect.innerHTML = '<option value="">Без ответственного</option>';
  options.forEach((person) => {
    const a = document.createElement('option');
    a.value = person.id;
    a.textContent = person.name;
    elements.createdBySelect.appendChild(a);
    const b = document.createElement('option');
    b.value = person.id;
    b.textContent = person.name;
    elements.assignedToSelect.appendChild(b);
  });
}

function renderParticipants(project) {
  elements.participantsList.innerHTML = '';
  if (!project || !project.participants.length) {
    elements.participantsList.innerHTML = '<div class="empty-state">Нет участников.</div>';
    return;
  }
  project.participants.forEach((person) => {
    const assignedCount = project.items.filter((item) => item.assignedTo === person.id).length;
    const card = document.createElement('div');
    card.className = 'participant-card';
    card.innerHTML = `<strong>${person.name}</strong><div class="muted">${assignedCount} позиций</div>`;
    elements.participantsList.appendChild(card);
  });
  elements.participantsList.classList.toggle('collapsed', !state.participantsExpanded);
}

function renderItems(project) {
  elements.itemsList.innerHTML = '';
  if (!project || !project.items.length) {
    elements.itemsList.innerHTML = '<div class="empty-state">Список покупок пока пуст.</div>';
    return;
  }
  project.items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-row">
        <div class="item-main">
          <p class="item-title">${item.title}</p>
          <p class="item-meta">${item.quantity} ${item.unit}${item.comment ? ` · ${item.comment}` : ''}</p>
        </div>
        <div class="item-owner">${statusBadge(item)}</div>
        <div class="item-owner">Ответственный: ${item.assignedTo ? personName(project, item.assignedTo) : '—'}</div>
        <div class="item-actions">
          <select data-action="assign">
            <option value="">Назначить</option>
            ${project.participants.map((person) => `<option value="${person.id}" ${item.assignedTo === person.id ? 'selected' : ''}>${person.name}</option>`).join('')}
          </select>
          <input data-action="price" type="number" min="0" placeholder="Цена" value="${item.price ?? ''}" />
          <button class="btn btn-secondary" data-action="take-self" type="button">Себе</button>
          <button class="btn btn-primary" data-action="done" type="button">Готово</button>
        </div>
      </div>
    `;

    card.querySelector('[data-action="assign"]').addEventListener('change', async (event) => {
      await updateItem(project.id, item.id, { assignedTo: event.target.value || null });
    });
    card.querySelector('[data-action="price"]').addEventListener('change', async (event) => {
      await updateItem(project.id, item.id, { price: event.target.value || null });
    });
    card.querySelector('[data-action="take-self"]').addEventListener('click', async () => {
      const firstParticipant = project.participants[0];
      if (!firstParticipant) return alert('Сначала добавь участника.');
      await updateItem(project.id, item.id, { assignedTo: firstParticipant.id });
    });
    card.querySelector('[data-action="done"]').addEventListener('click', async () => {
      await updateItem(project.id, item.id, { status: 'done' });
    });
    elements.itemsList.appendChild(card);
  });
}

function syncPanels() {
  elements.projectsDrawer.classList.toggle('hidden', !state.projectsExpanded && window.innerWidth > 980);
  elements.participantsPanel.classList.toggle('hidden', false);
}

function renderAll() {
  const project = getCurrentProject();
  renderProjects();
  renderOverview(project);
  populateParticipantSelects(project);
  renderParticipants(project);
  renderItems(project);
  syncPanels();
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
  state.projectsExpanded = false;
  syncPanels();

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
  elements.toggleProjects.addEventListener('click', () => {
    state.projectsExpanded = !state.projectsExpanded;
    syncPanels();
  });
  elements.toggleParticipants.addEventListener('click', () => {
    state.participantsExpanded = !state.participantsExpanded;
    renderAll();
  });

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
