// Vista Obiettivi: gli obiettivi in corso con il loro avanzamento, e l'archivio di quelli raggiunti

import { goals, goalProgress, goalValue, items } from '../data/db.js';
import { icon } from '../icons.js';
import { areaById, areaAttrs, escapeHtml } from '../ui.js';
import { todayISO, formatDayShort, formatTimeLeft, dateInRome } from '../dates.js';
import { openGoalEditor } from '../goal-editor.js';

export const title = 'Obiettivi';

export function eyebrow() {
  const active = goals.filter((g) => !g.achieved_at).length;
  return active === 1 ? '1 in corso' : `${active} in corso`;
}

// Numeri all'italiana: 2000 -> "2.000", 12.5 -> "12,5"
const numberFormat = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

// "3 di 8 passi" oppure "800 / 2.000 €"
export function goalAmount(goal) {
  if (goal.kind === 'number') {
    const unit = goal.unit ? ` ${escapeHtml(goal.unit)}` : '';
    return `${numberFormat.format(goalValue(goal))} / ${numberFormat.format(goal.target_value)}${unit}`;
  }
  const steps = items.filter((i) => i.goal_id === goal.id && !i.parent_id);
  const done = steps.filter((s) => s.done).length;
  return steps.length ? `${done} di ${steps.length} passi` : 'Nessun passo ancora';
}

function goalRow(goal, today) {
  const percent = Math.round(goalProgress(goal) * 100);
  const area = goal.area_id ? areaById(goal.area_id) : null;
  const meta = [];
  if (area) meta.push(`<span><span class="dot"></span>${escapeHtml(area.name)}</span>`);
  if (goal.achieved_at) {
    meta.push(`<span>${icon('trophy')}Raggiunto il ${formatDayShort(dateInRome(goal.achieved_at))}</span>`);
  } else if (goal.target_date) {
    const left = formatTimeLeft(today, goal.target_date);
    meta.push(`<span class="${goal.target_date < today ? 'is-late' : ''}">${icon('calendar')}Entro ${formatDayShort(goal.target_date)}, ${left}</span>`);
  }

  return `
    <li class="goal" data-goal-id="${goal.id}" ${area ? areaAttrs(area) : ''}>
      <button class="goal__open" type="button" data-action="open-goal">
        <span class="goal__title">${escapeHtml(goal.title)}</span>
        <span class="item__meta">${meta.join('')}</span>
        <span class="goal__progress">
          <span class="progress__track" role="progressbar" aria-label="Avanzamento" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
            <span class="progress__fill goal__fill" style="width: ${percent}%"></span>
          </span>
          <span class="goal__amount num">${goalAmount(goal)}</span>
        </span>
      </button>
    </li>`;
}

export function render(container) {
  const today = todayISO();
  // in corso: prima quelli con la scadenza più vicina, poi quelli senza scadenza
  const active = goals
    .filter((g) => !g.achieved_at)
    .sort((a, b) => (a.target_date ?? '9999').localeCompare(b.target_date ?? '9999'));
  const achieved = goals
    .filter((g) => g.achieved_at)
    .sort((a, b) => b.achieved_at.localeCompare(a.achieved_at));

  container.innerHTML = `
    <div>
      <button class="btn btn--primary" type="button" data-action="new-goal">${icon('plus')}Nuovo obiettivo</button>
    </div>

    ${active.length
      ? `<ul class="goal-list">${active.map((g) => goalRow(g, today)).join('')}</ul>`
      : `<div class="placeholder">
          <p>Nessun obiettivo in corso</p>
          <p>Un obiettivo è qualcosa che vuoi raggiungere nei prossimi mesi: dividilo in passi
          e l'app te li proporrà nei momenti liberi.</p>
        </div>`}

    ${achieved.length ? `
      <details class="archive">
        <summary class="section__head">${icon('trophy')}Raggiunti <span class="count num">${achieved.length}</span></summary>
        <ul class="goal-list">${achieved.map((g) => goalRow(g, today)).join('')}</ul>
      </details>` : ''}
  `;

  container.onclick = (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'new-goal') openGoalEditor(null);
    if (button.dataset.action === 'open-goal') openGoalEditor(button.closest('[data-goal-id]').dataset.goalId);
  };
}
