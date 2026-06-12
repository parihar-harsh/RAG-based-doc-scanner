import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

let authToken = localStorage.getItem('talk-to-my-doc-token');

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

setAuthToken(authToken);

export function getAuthToken() {
  return authToken;
}

// ── Auth ──

export async function signup(payload) {
  const response = await api.post('/auth/signup', payload);
  return response.data;
}

export async function login(payload) {
  const response = await api.post('/auth/login', payload);
  return response.data;
}

export async function getCurrentUser() {
  const response = await api.get('/auth/me');
  return response.data;
}

export async function logout() {
  const response = await api.post('/auth/logout');
  return response.data;
}

// ── Documents ──

export async function uploadDocument(file, onUploadProgress) {
  const formData = new FormData();
  formData.append('document', file);

  const response = await api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  });
  return response.data;
}

export async function getDocuments() {
  const response = await api.get('/documents');
  return response.data;
}

export async function getDocument(id) {
  const response = await api.get(`/documents/${id}`);
  return response.data;
}

export async function deleteDocument(id) {
  const response = await api.delete(`/documents/${id}`);
  return response.data;
}

// ── Chat ──

export function chatWithDocument(documentId, question, conversationId) {
  const baseURL = import.meta.env.VITE_API_URL || '/api';
  const body = JSON.stringify({ question, conversationId });

  return fetch(`${baseURL}/chat/${documentId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body,
  });
}

export async function listConversations(documentId) {
  const response = await api.get(`/chat/${documentId}/conversations`);
  return response.data;
}

export async function getConversation(conversationId) {
  const response = await api.get(`/chat/conversations/${conversationId}`);
  return response.data;
}

export async function deleteConversation(conversationId) {
  const response = await api.delete(`/chat/conversations/${conversationId}`);
  return response.data;
}

export default api;
