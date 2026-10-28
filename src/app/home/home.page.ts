import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common'; 
import { FormsModule } from '@angular/forms'; 
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonSearchbar,
  IonInput, IonSelect, IonSelectOption,
  IonList, IonItem, IonLabel, IonAvatar, IonBadge, IonButton, IonIcon,
  IonModal, IonNote, IonSpinner, ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { eyeOutline, closeOutline } from 'ionicons/icons';

import { ApiService } from '../services/api.service';
import { Student } from '../models/student.model';

/**
 * ============================================================================
 *  CONFIGURACIÓN 
 * ============================================================================
 */
export interface PageConfig {
  pageTitle: string;
  filtersCardTitle: string;
  searchPlaceholder: string;
  minNoteLabel: string;
  maxNoteLabel: string;
  searchFields: (keyof Student)[];
  
  /** Campo numérico que define el umbral (ej. nota). */
  noteField: keyof Student;
  /** Campo que se muestra como título de cada fila y del modal. */
  nameField: keyof Student;
  /** Campo que se muestra como descripción en las filas y en el modal. */
  descriptionField: keyof Student;
  /** Etiqueta descriptiva de la nota. */
  noteLabel: string;
  
  /** Nota por debajo de la cual el estudiante se marca como reprobado / crítico. */
  noteThreshold: number;
  criticalLabel: string;
  stableLabel: string;
  
  /** Etiquetas del desglose en el modal. */
  netLabel: string;
  totalLabel: string;
  modalTitle: string;
  confirmActionLabel: string;
  viewDetailLabel: string;
  
  /** Métricas del dashboard. */
  visibleStudentsLabel: string;
  averageNoteLabel: string;
  criticalNoteLabel: string;
  visibleStudentsHint: string;
  
  /** Ordenamiento del listado. */
  sortLabel: string;
  sortNoneLabel: string;
  sortNoteAscLabel: string;
  sortNoteDescLabel: string;
  
  /** Botones y mensajes. */
  clearFiltersLabel: string;
  requiredFieldMessage: string;
  rangeErrorMessage: string;
  emptyListMessage: string;
  loadErrorMessage: string;
  retryLabel: string;
  confirmMessage: string;
  closeMessage: string;
  idPrefix: string;
}

/** Órdenes posibles del listado. */
export type SortOrder = 'none' | 'noteAsc' | 'noteDesc';

/** Estado de los filtros. */
export interface Filters {
  query: string;
  min: number;
  max: number;
  sort: SortOrder;
}

/** Resultado de las métricas del dashboard de estudiantes. */
export interface StudentMetrics {
  visibleCount: number;
  averageNote: number;
  criticalCount: number;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrl: 'home.page.scss',
  standalone: true,
  imports: [
    DecimalPipe, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonSearchbar,
    IonInput, IonSelect, IonSelectOption,
    IonList, IonItem, IonLabel, IonAvatar, IonBadge, IonButton, IonIcon,
    IonModal, IonNote, IonSpinner
  ]
})
export class HomePage implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly toastController = inject(ToastController);

  readonly config: PageConfig = {
    pageTitle: 'Gestión y Control de Estudiantes',
    filtersCardTitle: 'Panel de Búsqueda y Filtros',
    searchPlaceholder: 'Buscar por nombre o descripción...',
    minNoteLabel: 'Nota mínima',
    maxNoteLabel: 'Nota máxima',
    searchFields: ['name', 'body'],
    noteField: 'note',
    nameField: 'name',
    descriptionField: 'body',
    noteLabel: 'Calificación',
    
    noteThreshold: 3, // Menor a 3 se considera reprobado
    criticalLabel: 'Reprobado',
    stableLabel: 'Aprobado',
  
    netLabel: 'Calificación Obtenida',
    totalLabel: 'Estado Académico',
    modalTitle: 'Detalle del Estudiante',
    confirmActionLabel: 'Aceptar',
    viewDetailLabel: 'Ver detalle',
    visibleStudentsLabel: 'Estudiantes visibles',
    averageNoteLabel: 'Promedio de notas',
    criticalNoteLabel: 'Estudiantes Reprobados',
    visibleStudentsHint: 'según los filtros aplicados',
    sortLabel: 'Ordenar por',
    sortNoneLabel: 'Orden original',
    sortNoteAscLabel: 'Nota: menor a mayor',
    sortNoteDescLabel: 'Nota: mayor a menor',
    
    clearFiltersLabel: 'Limpiar filtros',
    requiredFieldMessage: 'Este campo es obligatorio (0 es un valor válido).',
    rangeErrorMessage: 'La nota mínima no puede ser mayor que la nota máxima.',
    emptyListMessage: 'No se encontraron estudiantes que coincidan con la búsqueda.',
    loadErrorMessage: 'No se pudieron cargar los registros. Intenta nuevamente.',
    retryLabel: 'Reintentar',
    confirmMessage: 'Acción realizada correctamente.',
    closeMessage: 'Detalle cerrado correctamente.',
    idPrefix: '#',
  };

  private readonly defaultFilters: Filters = {
    query: '',
    min: 0,
    max: 5, // Asumiendo escala de notas de 0 a 5
    sort: 'none',
  };

  // ── Datos ────────────────────────────────────────────────────────────────
  readonly items = signal<Student[]>([]);
  readonly selectedItem = signal<Student | null>(null);

  // ── Filtros interactivos ─────────────────────────────────────────────────
  filters: Filters = { ...this.defaultFilters };

  // ── Estado de la UI ──────────────────────────────────────────────────────
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly isModalOpen = signal(false);

  private dismissMessage = this.config.closeMessage;

  constructor() {
    addIcons({ eyeOutline, closeOutline });
  }

  ngOnInit(): void {
    this.loadData();
  }

  /**
   * FILTRO + ORDENAMIENTO DERIVADO
   */
  get filteredItems(): Student[] {
    const term = this.filters.query.trim().toLowerCase();
    const useRange = this.rangeError === null;
    const min = useRange ? this.filters.min : null;
    const max = useRange ? this.filters.max : null;

    const result = this.items().filter(item => {
      const matchesText = !term || this.config.searchFields.some(field =>
        String(item[field] ?? '').toLowerCase().includes(term));

      const note = this.noteOf(item);
      const matchesMin = !this.isFiniteNumber(min) || note >= (min as number);
      const matchesMax = !this.isFiniteNumber(max) || note <= (max as number);

      return matchesText && matchesMin && matchesMax;
    });

    const sorted = [...result];
    switch (this.filters.sort) {
      case 'noteAsc':
        sorted.sort((a, b) => this.noteOf(a) - this.noteOf(b));
        break;
      case 'noteDesc':
        sorted.sort((a, b) => this.noteOf(b) - this.noteOf(a));
        break;
      default:
        break;
    }

    return sorted;
  }

  /**
   * MÉTRICAS DEL DASHBOARD
   */
  get metrics(): StudentMetrics {
    const visible = this.filteredItems;
    const totalNotes = visible.reduce((acc, item) => acc + this.noteOf(item), 0);
    
    return {
      visibleCount: visible.length,
      averageNote: visible.length > 0 ? totalNotes / visible.length : 0,
      criticalCount: visible.reduce(
        (acc, item) => acc + (this.isCriticalNote(item) ? 1 : 0), 0),
    };
  }

  get rangeError(): string | null {
    const { min, max } = this.filters;

    if (min === null || max === null || !this.isFiniteNumber(min) || !this.isFiniteNumber(max)) {
      return this.config.requiredFieldMessage;
    }
    if (min < 0 || max < 0) {
      return 'Las notas no pueden ser negativas.';
    }
    if (min > max) {
      return this.config.rangeErrorMessage;
    }
    return null;
  }

  resetFilters(): void {
    this.filters = { ...this.defaultFilters };
  }

  loadData(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.apiService.getItems().subscribe({
      next: (data) => {
        this.items.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando estudiantes:', err);
        this.loadError.set(this.config.loadErrorMessage);
        this.isLoading.set(false);
      }
    });
  }

  noteOf(item: Student): number {
    return Number(item[this.config.noteField]);
  }

  isCriticalNote(item: Student): boolean {
    return this.noteOf(item) < this.config.noteThreshold;
  }

  private isFiniteNumber(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  // ── Modal ────────────────────────────────────────────────────────────────
  openModal(item: Student): void {
    this.selectedItem.set(item);
    this.dismissMessage = this.config.closeMessage;
    this.isModalOpen.set(true);
  }

  closeModal(confirmed = false): void {
    this.dismissMessage = confirmed
      ? this.config.confirmMessage
      : this.config.closeMessage;
    this.isModalOpen.set(false);
  }

  onModalDismiss(): void {
    this.isModalOpen.set(false);
    this.selectedItem.set(null);
    void this.notify(this.dismissMessage);
    this.dismissMessage = this.config.closeMessage;
  }

  private async notify(message: string, color: string = 'success'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}