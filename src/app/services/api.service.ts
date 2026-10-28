import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Student } from '../models/student.model'; 
import { map } from 'rxjs/operators'; 

interface RawPost {
  id: number;
  userId: number;
  name: string;
  body: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient); // 👈 Tu sintaxis moderna de inyección

  private apiUrl = 'https://jsonplaceholder.typicode.com/comments';

  // 2. Cambiamos any[] por Student[] 
  getItems(): Observable<Student[]> {
    
    return this.http.get<RawPost[]>(this.apiUrl).pipe(
      map(posts => {
        return posts.map(post => ({
          ...post,
          note: (post.id * 3) % 5       
        }));
      })
    );
  }


  createItem(data: any): Observable<any> {
  return this.http.post<any>(this.apiUrl, data);
  }
}