import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';

export interface Folder {
  id: string;
  title: string;
  slug: string;
  coverImageUrl: string;
  sortOrder: number;
  worksCount: number;
}

export interface Work {
  id: string;
  title: string;
  imageUrl: string;
  details: Array<{
    key: string;
    value: string;
  }>;
  sortOrder: number;
}

export interface FolderDetails extends Folder {
  works: Work[];
}

interface AuthPayload {
  token: string;
  user: {
    id: string;
    login: string;
    name: string;
  };
}

const apiBaseUrl = process.env.REACT_APP_API_URL ?? 'http://localhost:4000';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${apiBaseUrl}/api`,
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  }
});

const baseQueryWithAuthGuard: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  const hasToken = Boolean(localStorage.getItem('admin_token'));
  const isUnauthorized = result.error?.status === 401;

  if (isUnauthorized && hasToken) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_preview_mode');

    if (typeof window !== 'undefined' && window.location.pathname !== '/admin') {
      window.location.assign('/admin');
    }
  }

  return result;
};

export const contentApi = createApi({
  reducerPath: 'contentApi',
  baseQuery: baseQueryWithAuthGuard,
  tagTypes: ['Folders', 'FolderDetails'],
  endpoints: (builder) => ({
    getFolders: builder.query<Folder[], void>({
      query: () => '/folders',
      providesTags: ['Folders']
    }),
    getFolderWorks: builder.query<FolderDetails, string>({
      query: (slug) => `/folders/${slug}/works`,
      providesTags: (_result, _error, slug) => [{ type: 'FolderDetails', id: slug }]
    }),
    login: builder.mutation<AuthPayload, { login: string; password: string }>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body
      })
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST'
      })
    }),
    createFolder: builder.mutation<Folder, FormData>({
      query: (body) => ({
        url: '/admin/folders',
        method: 'POST',
        body
      }),
      invalidatesTags: ['Folders']
    }),
    updateFolder: builder.mutation<FolderDetails, { id: string; body: FormData }>({
      query: ({ id, body }) => ({
        url: `/admin/folders/${id}`,
        method: 'PATCH',
        body
      }),
      invalidatesTags: ['Folders']
    }),
    deleteFolder: builder.mutation<void, string>({
      query: (id) => ({
        url: `/admin/folders/${id}`,
        method: 'DELETE'
      }),
      invalidatesTags: ['Folders']
    }),
    reorderFolder: builder.mutation<void, { id: string; direction: 'up' | 'down' }>({
      query: ({ id, direction }) => ({
        url: `/admin/folders/${id}/reorder`,
        method: 'POST',
        body: { direction }
      }),
      invalidatesTags: ['Folders', 'FolderDetails']
    }),
    uploadWorks: builder.mutation<Work[], { folderId: string; body: FormData }>({
      query: ({ folderId, body }) => ({
        url: `/admin/folders/${folderId}/works/upload`,
        method: 'POST',
        body
      }),
      invalidatesTags: ['Folders']
    }),
    updateWork: builder.mutation<Work, { id: string; body: FormData }>({
      query: ({ id, body }) => ({
        url: `/admin/works/${id}`,
        method: 'PATCH',
        body
      }),
      invalidatesTags: (_result, _error, args) => ['Folders', { type: 'FolderDetails', id: args.id }]
    }),
    deleteWork: builder.mutation<void, string>({
      query: (id) => ({
        url: `/admin/works/${id}`,
        method: 'DELETE'
      }),
      invalidatesTags: ['Folders']
    }),
    reorderWork: builder.mutation<void, { id: string; direction: 'up' | 'down' }>({
      query: ({ id, direction }) => ({
        url: `/admin/works/${id}/reorder`,
        method: 'POST',
        body: { direction }
      }),
      invalidatesTags: ['Folders', 'FolderDetails']
    })
  })
});

export const {
  useGetFoldersQuery,
  useGetFolderWorksQuery,
  useLoginMutation,
  useLogoutMutation,
  useCreateFolderMutation,
  useUpdateFolderMutation,
  useDeleteFolderMutation,
  useReorderFolderMutation,
  useUploadWorksMutation,
  useUpdateWorkMutation,
  useDeleteWorkMutation,
  useReorderWorkMutation
} = contentApi;
