const loginForm = document.getElementById('admin-login');
const content = document.getElementById('admin-content');
const error = document.getElementById('admin-login-error');
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));

async function loadDashboard() {
  const response = await fetch('/api/admin/dashboard');
  if (!response.ok) return false;
  const data = await response.json();
  loginForm.hidden = true;
  content.hidden = false;
  const labels = { tomorrowOrders:'Tomorrow orders', confirmedPlans:'Confirmed', awaitingReview:'Awaiting review', lunchPortions:'Lunch portions' };
  document.getElementById('admin-metrics').innerHTML = Object.entries(data.metrics).map(([key,value]) => `<div><span>${escapeHtml(labels[key] || key)}</span><strong>${value}</strong></div>`).join('');
  document.getElementById('admin-plan-rows').innerHTML = data.plans.map(plan => {
    const lunch = plan.meals.find(meal => meal.mealType === 'LUNCH');
    return `<tr><td>${escapeHtml(plan.userName)}<small>${escapeHtml(plan.dietaryPreference)}${plan.allergies ? ` · Allergy: ${escapeHtml(plan.allergies)}` : ''}</small></td><td>${plan.effectiveDailyTarget} kcal</td><td>${plan.cateringAllocation} kcal</td><td>${escapeHtml(lunch?.menuId || '—')}</td><td>${escapeHtml((plan.explanationCodes || []).join(', '))}</td><td><select data-plan-id="${escapeHtml(plan.id)}"><option>${escapeHtml(plan.status)}</option>${['DRAFT','CONFIRMED','LOCKED','FULFILLED','CANCELLED'].filter(value => value !== plan.status).map(value => `<option>${value}</option>`).join('')}</select></td></tr>`;
  }).join('') || '<tr><td colspan="6">No lunch plans for tomorrow.</td></tr>';
  document.querySelectorAll('[data-plan-id]').forEach(select => select.addEventListener('change', async () => {
    const response = await fetch(`/api/admin/plans/${encodeURIComponent(select.dataset.planId)}/status`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status:select.value}) });
    if (!response.ok) alert((await response.json()).error || 'Status update failed');
  }));
  return true;
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  error.textContent = '';
  const response = await fetch('/api/session', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:document.getElementById('admin-name').value,password:document.getElementById('admin-password').value}) });
  if (!response.ok || !(await loadDashboard())) error.textContent = 'This account does not have catering-admin access.';
});

loadDashboard();
