class StateStore {
  constructor() {
    this.listeners = new Set();
    this.currentUser = null;
    this.selectedUserId = null;
    this.role = null;
    this.workouts = [];
    this.foodLog = [];
    this.weightLogs = [];
    this.bodyStats = { bb: 65, tb: 171, age: 25, sex: 'male', activity: 'moderate', goal: 'maintain' };
    this.timerSec = 0;
    this.timerRunning = false;
    this.pendingMeal = null;
    this.pendingTab = 'dashboard';
    this.dashboard = null;
  }

  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  notify(event, payload) { this.listeners.forEach(listener => listener(event, payload, this)); }
  setCurrentUser(username, userId, role = null) {
    if (userId !== this.selectedUserId) {
      this.foodLog = [];
      this.workouts = [];
      this.weightLogs = [];
      this.dashboard = null;
    }
    this.currentUser = username || null;
    this.selectedUserId = userId || null;
    this.role = role;
    this.notify('auth_changed', { username, userId, role });
  }
  addWorkout(workout) { this.workouts.push(workout); this.notify('workouts_changed', this.workouts); }
  deleteWorkout(id) { this.workouts = this.workouts.filter(item => item.id !== id); this.notify('workouts_changed', this.workouts); }
  setWorkouts(list) { this.workouts = Array.isArray(list) ? list : []; this.notify('workouts_changed', this.workouts); }
  addFoodLog(entry) { this.foodLog.push(entry); this.dashboard = null; this.notify('food_changed', this.foodLog); }
  deleteFoodLog(id) { this.foodLog = this.foodLog.filter(item => item.id !== id); this.dashboard = null; this.notify('food_changed', this.foodLog); }
  setFoodLog(list) { this.foodLog = Array.isArray(list) ? list : []; this.notify('food_changed', this.foodLog); }
  setBodyStats(stats) { this.bodyStats = { ...this.bodyStats, ...stats }; this.dashboard = null; this.notify('bodystats_changed', this.bodyStats); }
  setDashboard(snapshot) {
    this.dashboard = snapshot;
    if (snapshot?.profile) this.bodyStats = snapshot.profile;
    if (snapshot?.foodLogs) this.foodLog = snapshot.foodLogs;
    if (snapshot?.activities) this.workouts = snapshot.activities;
    if (snapshot?.weights) this.weightLogs = snapshot.weights;
    this.notify('dashboard_changed', snapshot);
  }
  setTimerSec(seconds) { this.timerSec = seconds; this.notify('timer_tick', seconds); }
}

export const state = new StateStore();
