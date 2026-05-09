import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface Folder {
  id: string;
  title: string;
  slug: string;
  coverImageUrl: string;
  worksCount: number;
}

export interface Work {
  id: string;
  title: string;
  imageUrl: string;
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

export const contentApi = createApi({
  reducerPath: 'contentApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${apiBaseUrl}/api`,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('admin_token');
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    }
  }),
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
  useUploadWorksMutation,
  useUpdateWorkMutation,
  useDeleteWorkMutation
} = contentApi;
