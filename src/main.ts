import './style.css';
import { StateVar } from 'statebinderk';

const appRoot = document.getElementById('app');
if (appRoot) {
  appRoot.innerHTML = `<header id="app-title">Ticket to Ride: Nepal</header>`;
  const titleBinder = new StateVar<string>(
    'Ticket to Ride: Nepal — Himalayan Edition',
    'app-title',
    (el, text) => {
      el.textContent = text;
    }
  );
  titleBinder.transition('Ticket to Ride: Nepal — Himalayan Edition');
}
