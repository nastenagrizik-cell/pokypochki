const state = {
  projects: [],
  meta: { units: [] },
  currentProjectId: null,
  panels: { projects: false, participants: false },
  editingAssigneeItemId: null,
  editingPriceItemId: null
};

const elements = {
  projectTitle: document.getElementById('project-title'),
  progressLabel: document.getElementById('progress-label'),
  progressPercent: document.getElementById('progress-percent'),
  progressFill: document.getElementById('progress-fill'),
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

function ensureElements() {
  const required = ['projectTitle','progressLabel','progressPercent','progressFill','projectsPanel','participantsPanel','projectsList','participantsList','itemsList','unitSelect','assignedToSelect','participantForm','participantName','itemForm','projectForm','projectModal','closeProjectModal','projectsToggle','participantsToggle','newProjectBtn','themeToggle'];
  return required.every((key) => !!elements[key]);
}

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

function itemMeta(item) {
  const parts = [];
  if (item.quantity) parts.push(`${item.quantity}${item.unit ? ` ${item.unit}` : ''}`);
  if (item.comment) parts.push(item.comment);
  return parts.join(' · ');
}

function renderTop() {
  const project = currentProject();
  if (!project) {
    elements.projectTitle.textContent = 'Совместные покупки';
    elements.progressLabel.textContent = 'Создай первый проект';
    elements.progressPercent.textContent = '0%';
    elements.progressFill.style.width = '0%';
    return;
  }
  elements.projectTitle.textContent = project.name || 'Без названия';
  elements.progressLabel.textContent = `${project.stats.completed} из ${project.stats.total} куплено · ${project.stats.totalSpent} ₽`;
  elements.progressPercent.textContent = `${project.stats.progress}%`;
  elements.progressFill.style.width = `${project.stats.progress}%`;
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
      state.editingAssigneeItemId = null;
      state.editingPriceItemId = null;
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

function assigneeTemplate(project, item) {
  const person = findPerson(project, item.assignedTo);
  if (state.editingAssigneeItemId === item.id) {
    return `
      <div class="assignee-editor">
        <select data-action="assign-select">
          <option value="">Без ответственного</option>
          ${project.participants.map((entry) => `<option value="${entry.id}" ${item.assignedTo === entry.id ? 'selected' : ''}>${entry.name}</option>`).join('')}
        </select>
      </div>
    `;
  }
  if (!person) {
    return '<button class="assignee-empty" type="button" data-action="edit-assignee">Без ответственного</button>';
  }
  return `<button class="assignee-pill" type="button" data-action="edit-assignee" style="background:${person.color}">${person.name}</button>`;
}

function priceTemplate(item) {
  if (state.editingPriceItemId === item.id) {
    return `<input class="price-input-inline" data-action="price-input" type="number" min="0" placeholder="Цена" value="${item.price ?? ''}" />`;
  }
  return `<button class="price-box ${item.price ? 'strong' : ''}" type="button" data-action="edit-price">${item.price ? `${item.price} ₽` : 'Цена —'}</button>`;
}

function rowTemplate(project, item) {
  const done = item.status === 'done';
  const meta = itemMeta(item);
  return `
    <div class="item-row ${done ? 'done' : ''}" data-item-id="${item.id}">
      <button class="check-btn ${done ? 'done' : ''}" type="button" data-action="toggle-done">${done ? '✓' : ''}</button>
      <div class="row-main">
        <p class="product-title">${item.title}</p>
        ${meta ? `<p class="product-meta">${meta}</p>` : ''}
      </div>
      <div class="assignee-area">${assigneeTemplate(project, item)}</div>
      <div class="row-actions">
        ${priceTemplate(item)}
        <button class="delete-btn" type="button" data-action="delete">✕</button>
      </div>
    </div>
  `;
}

function resetEditors() {
  state.editingAssigneeItemId = null;
  state.editingPriceItemId = null;
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

    const assigneeButton = row.querySelector('[data-action="edit-assignee"]');
    if (assigneeButton) {
      assigneeButton.addEventListener('click', (event) => {
        event.stopPropagation();
        state.editingAssigneeItemId = item.id;
        state.editingPriceItemId = null;
        renderItems();
      });
    }

    const assigneeSelect = row.querySelector('[data-action="assign-select"]');
    if (assigneeSelect) {
      setTimeout(() => assigneeSelect.focus(), 0);
      assigneeSelect.addEventListener('change', async (event) => {
        resetEditors();
        await updateItem(project.id, item.id, { assignedTo: event.target.value || null });
      });
      assigneeSelect.addEventListener('blur', () => {
        resetEditors();
        renderItems();
      });
    }

    const editPriceButton = row.querySelector('[data-action="edit-price"]');
    if (editPriceButton) {
      editPriceButton.addEventListener('click', (event) => {
        event.stopPropagation();
        state.editingPriceItemId = item.id;
        state.editingAssigneeItemId = null;
        renderItems();
      });
    }

    const priceInput = row.querySelector('[data-action="price-input"]');
    if (priceInput) {
      setTimeout(() => priceInput.focus(), 0);
      priceInput.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          resetEditors();
          await updateItem(project.id, item.id, { price: event.target.value || null });
        }
        if (event.key === 'Escape') {
          resetEditors();
          renderItems();
        }
      });
      priceInput.addEventListener('blur', async (event) => {
        resetEditors();
        await updateItem(project.id, item.id, { price: event.target.value || null });
      });
    }

    row.querySelector('[data-action="toggle-done"]').addEventListener('click', async () => {
      if (item.status === 'done') {
        await updateItem(project.id, item.id, { status: item.assignedTo ? 'assigned' : 'open' });
        return;
      }
      const value = window.prompt('Укажи цену для завершенной покупки', item.price ?? '');
      if (value === null || !String(value).trim()) {
        return;
      }
      await updateItem(project.id, item.id, { status: 'done', price: String(value).trim() });
    });

    row.querySelector('[data-action="delete"]').addEventListener('click', async (event) => {
      event.stopPropagation();
      await request(`/api/projects/${project.id}/items/${item.id}`, { method: 'DELETE' });
      await refreshProjects();
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
  if (!ensureElements()) {
    throw new Error('Не найдены обязательные элементы интерфейса. Обнови index.html и app.js одной версией.');
  }

  state.meta = await request('/api/meta');
  elements.unitSelect.innerHTML = ['<option value="">Ед.</option>']
    .concat(state.meta.units.map((unit) => `<option value="${unit}">${unit}</option>`))
    .join('');

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
    if (!payload.quantity) payload.quantity = '';
    const updatedProject = await request(`/api/projects/${project.id}/items`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.projects = state.projects.map((entry) => entry.id === updatedProject.id ? updatedProject : entry);
    elements.itemForm.reset();
    elements.unitSelect.value = '';
    renderAll();
  });

  let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  elements.themeToggle.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.assignee-area') && state.editingAssigneeItemId !== null) {
      state.editingAssigneeItemId = null;
      renderItems();
    }
  });

  setInterval(refreshProjects, 15000);
}

init().catch((error) => {
  console.error(error);
  alert(error.message || 'Ошибка загрузки приложения');
});
