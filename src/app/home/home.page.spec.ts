import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular';
import { of } from 'rxjs';

import { HomePage } from './home.page';
import { ApiService } from '../services/api.service';
import { Student } from '../models/student.model';

const STUDENTS: Student[] = [
  { id: 1, userId: 1, name: 'Estudiante Bajo', body: 'descripción uno', note: 2 },
  { id: 2, userId: 1, name: 'Estudiante Alto', body: 'descripción dos', note: 4 },
];

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let createdToasts: { message: string }[];

  beforeEach(async () => {
    createdToasts = [];

    await TestBed.configureTestingModule({
      providers: [
        // Evita la petición HTTP real en las pruebas.
        { provide: ApiService, useValue: { getItems: () => of(STUDENTS) } },
        // Evita crear el toast real y guarda los mensajes para comprobarlos.
        {
          provide: ToastController,
          useValue: {
            create: async (options: { message: string }) => {
              createdToasts.push(options);
              return { present: async () => undefined };
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges(); // dispara ngOnInit → loadData()
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('carga todos los registros al iniciar', () => {
    expect(component.items().length).toBe(2);
    expect(component.filteredItems.length).toBe(2);
  });

  it('renderiza el listado con ion-avatar, textos y badge', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('ion-avatar').length).toBe(2);
    expect(host.textContent).toContain('Estudiante Bajo');
    expect(host.textContent).toContain(component.config.noteLabel);
  });

  it('pinta el badge de rojo solo cuando la nota es menor que el umbral (3)', () => {
    const host = fixture.nativeElement as HTMLElement;
    const badges = host.querySelectorAll('ion-badge');

    // Primer registro: nota 2 → danger. Segundo: nota 4 → success.
    expect(badges[0].getAttribute('color')).toBe('danger');
    expect(badges[1].getAttribute('color')).toBe('success');
    expect(component.isCriticalNote(STUDENTS[0])).toBe(true);
    expect(component.isCriticalNote(STUDENTS[1])).toBe(false);
  });

  it('coloca las acciones al pie del texto, dentro de ion-label', () => {
    const host = fixture.nativeElement as HTMLElement;
    const item = host.querySelector('ion-item');

    expect(item?.querySelector('[slot="end"]')).toBeNull();
    const label = item?.querySelector('ion-label');
    expect(label?.querySelector('.item-actions')).not.toBeNull();
    expect(label?.querySelector('.row-description')).not.toBeNull();
    expect(label?.lastElementChild?.classList.contains('item-actions')).toBe(true);
  });

  it('muestra el texto del botón de detalle definido en config', () => {
    const host = fixture.nativeElement as HTMLElement;
    const button = host.querySelector('.item-actions ion-button');

    expect(button?.textContent).toContain(component.config.viewDetailLabel);
  });

  it('filtra por texto en cualquiera de los campos configurados', () => {
    component.filters.query = 'Alto';
    expect(component.filteredItems.length).toBe(1);
    expect(component.filteredItems[0].name).toBe('Estudiante Alto');

    component.filters.query = 'descripción uno';
    expect(component.filteredItems.length).toBe(1);
    expect(component.filteredItems[0].id).toBe(1);
  });

  it('filtra por rango de notas (mínimo y máximo)', () => {
    component.filters.min = 3;
    component.filters.max = 5;
    expect(component.filteredItems.map(item => item.id)).toEqual([2]);

    component.filters.min = 0;
    component.filters.max = 2.5;
    expect(component.filteredItems.map(item => item.id)).toEqual([1]);
  });

  it('aplica el límite 0 en lugar de ignorarlo', () => {
    component.filters.min = 0;
    component.filters.max = 0;

    expect(component.filteredItems.length).toBe(0);
  });

  it('valida el rango: mínimo mayor que máximo muestra error y no filtra', () => {
    component.filters.min = 4;
    component.filters.max = 2;

    expect(component.rangeError).toBe(component.config.rangeErrorMessage);
    expect(component.filteredItems.length).toBe(2);
  });

  it('valida campos obligatorios vacíos', () => {
    component.filters.min = null as any;

    expect(component.rangeError).toBe(component.config.requiredFieldMessage);
    expect(component.filteredItems.length).toBe(2);
  });

  it('ordena con sort(): nota ascendente y nota descendente', () => {
    component.filters.sort = 'noteAsc';
    expect(component.filteredItems.map(item => item.note)).toEqual([2, 4]);

    component.filters.sort = 'noteDesc';
    expect(component.filteredItems.map(item => item.note)).toEqual([4, 2]);
  });

  it('calcula las métricas sobre los registros filtrados', () => {
    // Notas 2 y 4 → Promedio = 3, Reprobados = 1
    expect(component.metrics.visibleCount).toBe(2);
    expect(component.metrics.averageNote).toBe(3);
    expect(component.metrics.criticalCount).toBe(1);

    component.filters.query = 'Alto';

    expect(component.metrics.visibleCount).toBe(1);
    expect(component.metrics.averageNote).toBe(4);
    expect(component.metrics.criticalCount).toBe(0);
  });

  it('mantiene los datos originales y limpia los filtros', () => {
    component.filters.query = 'Alto';
    component.filters.min = 3;
    component.filters.max = 5;
    component.filters.sort = 'noteDesc';

    component.resetFilters();

    expect(component.filters).toEqual({ query: '', min: 0, max: 5, sort: 'none' });
    expect(component.filteredItems.length).toBe(2);
    expect(component.items().length).toBe(2);
  });

  it('muestra el toast al cerrar el modal con el mensaje de la acción', async () => {
    component.openModal(STUDENTS[0]);
    component.closeModal(true);
    component.onModalDismiss();
    await Promise.resolve();

    expect(createdToasts.at(-1)?.message).toBe(component.config.confirmMessage);

    component.openModal(STUDENTS[0]);
    component.closeModal();
    component.onModalDismiss();
    await Promise.resolve();

    expect(createdToasts.at(-1)?.message).toBe(component.config.closeMessage);
  });
});