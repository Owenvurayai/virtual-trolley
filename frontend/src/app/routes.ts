import { Routes } from '@angular/router';
import { CashierScreen } from './features/cashier-screen/cashier-screen';
import { Dashboard } from './features/dashboard/dashboard';

export const routes: Routes = [
  { path: '', component: Dashboard, title: 'Virtual Trolley' },
  { path: 'cashier', component: CashierScreen, title: 'Cashier screens' }, // open in a second tab
  { path: '**', redirectTo: '' },
];
