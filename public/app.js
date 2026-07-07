const state = {
  projects: [],
  meta: { units: [] },
  currentProjectId: null,
  panels: {
    projects: false,
    participants: false
  }
};

const elements = {
  projectTitle: document.getElementById('project-title'),
  progressInline: document.getElementById('progress-inline'),
  listSubtitle: document.getElementById('list-subtitle'),
  projectsPanel: document.getElementById('projects-panel'),
  participantsPanel: document.getElementById('participants-panel'),
  projectsList: document.getElementById('projects-list'),
  participantsList: document.getElementById('participants-list'),
  itemsList: document.getElementById('items-list'),
  unitSelect: document.getElementById('unit-select'),
  assignedToSelect: document.getElementById('assigned-to-select'),
  participantForm: document.getElementById('participant-form'),
  participantName: document.getElementById('participant-name'),
  itemForm: document.getElementById('item-form'),
  projectForm: document.getElementById('project-form'),
  projectModal: document.getElementById('project-modal'),
  closeProjectModal: document.getElementById('close-project-modal'),
  projectsToggle: document.getElementById('projects-toggle'),
  participantsToggle: document.getElementById('participants-toggle'),
  newProjectBtn: document.getElementById('new-project-btn'),
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

function currentProject() {
  return state.projects.find((project) => project.id === state.currentProjectId) || state.projects[0] || null;
}

function findPerson(project, id) {
  return project?.participants.find((person) => person.id === id) || null;
}

function sortedItems(project) {
  return [...project.items].sort((a, b) => {
    const aDone = a.status === 'done' ? 1 : 0;
    const bDone = b.status === 'done' ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
}

function renderTop() {
  const project = currentProject();
  if (!project) {
    elements.projectTitle.textContent = 'Совместные покупки';
    elements.progressInline.textContent = 'Создай первый проект';
    elements.listSubtitle.textContent = 'Добавь проект, участников и список покупок.';
    return;
  }
  elements.projectTitle.textContent = project.name;
  elements.progressInline.textContent = `${project.stats.completed} из ${project.stats.total} куплено · ${project.stats.progress}% · ${project.stats.totalSpent} ₽`;
  elements.listSubtitle.textContent = 'Активные покупки сверху, выполненные автоматически уходят вниз.';
}

function renderProjects() {
  elements.projectsList.innerHTML = '';
  if (!state.projects.length) {
    elements.projectsList.innerHTML = '<div class="empty-state">Пока нет проектов.</div>';
    return;
  }
  state.projects.forEach((project) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `project-chip ${project.id === state.currentProjectId ? 'active' : ''}`;
    button.textContent = `${project.name} · ${project.stats.completed}/${project.stats.total}`;
    button.addEventListener('click', () => {
      state.currentProjectId = project.id;
      state.panels.projects = false;
      syncPanels();
      renderAll();
    });
    elements.projectsList.appendChild(button);
  });
}

function renderParticipants() {
  const project = currentProject();
  elements.participantsList.innerHTML = '';
  if (!project || !project.participants.length) {
    elements.participantsList.innerHTML = '<div class="empty-state">Участников пока нет.</div>';
    return;
  }
  project.participants.forEach((person) => {
    const chip = document.createElement('div');
    chip.className = 'participant-chip';
    chip.innerHTML = `<span style="width:10px;height:10px;border-radius:50%;background:${person.color};display:inline-block"></span>${person.name}`;
    elements.participantsList.appendChild(chip);
  });
}

function populateSelects() {
  const project = currentProject();
  elements.assignedToSelect.innerHTML = '<option value="">Без ответственного</option>';
  if (!project) return;
  project.participants.forEach((person) => {
    const option = document.createElement('option');
    option.value = person.id;
    option.textContent = person.name;
    elements.assignedToSelect.appendChild(option);
  });
}

function assigneeView(project, item) {
  const person = findPerson(project, item.assignedTo);
  if (!person) {
    return '<span class="assignee-empty">Без ответственного</span>';
  }
  return `<span class="assignee-pill" style="background:${person.color}">${person.name}</span>`;
}

function rowTemplate(project, item) {
  const done = item.status === 'done';
  return `
    <div class="item-row ${done ? 'done' : ''}" data-item-id="${item.id}">
      <button class="check-btn ${done ? 'done' : ''}" type="button" data-action="toggle-done">${done ? '✓' : ''}</button>
      <div>
        <p class="product-title">${item.title}</p>
        <p class="product-meta">${item.quantity} ${item.unit}${item.comment ? ` · ${item.comment}` : ''}</p>
      </div>
      <div>${assigneeView(project, item)}</div>
      <div class="price-box">${item.price ? `Потрачено: ${item.price} ₽` : 'Цена не указана'}</div>
      <div class="inline-actions">
        <select data-action="assign">
          <option value="">Без ответственного</option>
          ${project.participants.map((person) => `<option value="${person.id}" ${item.assignedTo === person.id ? 'selected' : ''}>${person.name}</option>`).join('')}
        </select>
        <button class="small-btn" type="button" data-action="price">Цена</button>
        <button class="small-btn ${done ? 'undo' : ''}" type="button" data-action="undo">${done ? 'Отменить' : 'Сбросить'}</button>
      </div>
    </div>
  `;
}

function renderItems() {
  const project = currentProject();
  elements.itemsList.innerHTML = '';
  if (!project || !project.items.length) {
    elements.itemsList.innerHTML = '<div class="empty-state">Список покупок пока пуст.</div>';
    return;
  }

  sortedItems(project).forEach((item) => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = rowTemplate(project, item);
    const row = wrapper.firstElementChild;

    row.querySelector('[data-action="assign"]').addEventListener('change', async (event) => {
      await updateItem(project.id, item.id, { assignedTo: event.target.value || null });
    });

    row.querySelector('[data-action="price"]').addEventListener('click', async () => {
      const value = prompt('Сколько потратили?', item.price ?? '');
      if (value === null) return;
      await updateItem(project.id, item.id, { price: value || null });
    });

    row.querySelector('[data-action="toggle-done"]').addEventListener('click', async () => {
      if (item.status === 'done') {
        await updateItem(project.id, item.id, { status: item.assignedTo ? 'assigned' : 'open' });
        return;
      }
      const value = prompt('Если покупка уже сделана, введи цену. Можно оставить пустым.', item.price ?? '');
      if (value === null) return;
      await updateItem(project.id, item.id, {
        status: 'done',
        price: value || item.price || null
      });
    });

    row.querySelector('[data-action="undo"]').addEventListener('click', async () => {
      await updateItem(project.id, item.id, {
        status: item.assignedTo ? 'assigned' : 'open',
        price: item.status === 'done' ? null : item.price
      });
    });

    elements.itemsList.appendChild(row);
  });
}

function syncPanels() {
  elements.projectsPanel.classList.toggle('hidden', !state.panels.projects);
  elements.participantsPanel.classList.toggle('hidden', !state.panels.participants);
}

function renderAll() {
  renderTop();
  renderProjects();
  renderParticipants();
  populateSelects();
  renderItems();
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

  elements.projectsToggle.addEventListener('click', () => {
    state.panels.projects = !state.panels.projects;
    if (state.panels.projects) state.panels.participants = false;
    syncPanels();
  });

  elements.participantsToggle.addEventListener('click', () => {
    state.panels.participants = !state.panels.participants;
    if (state.panels.participants) state.panels.projects = false;
    syncPanels();
  });

  elements.newProjectBtn.addEventListener('click', () => {
    elements.projectModal.showModal();
  });

  elements.closeProjectModal.addEventListener('click', () => {
    elements.projectModal.close();
  });

  elements.projectForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(elements.projectForm).entries());
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

  elements.participantForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const project = currentProject();
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
    const project = currentProject();
    if (!project) return;
    const payload = Object.fromEntries(new FormData(elements.itemForm).entries());
    const updatedProject = await request(`/api/projects/${project.id}/items`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.projects = state.projects.map((entry) => entry.id === updatedProject.id ? updatedProject : entry);
    elements.itemForm.reset();
    elements.unitSelect.value = state.meta.units[0] || 'шт';
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
