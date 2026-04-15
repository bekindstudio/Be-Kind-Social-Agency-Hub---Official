import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  useClientPosts,
  useCreatePost,
  useDeletePost,
  useUpdatePost,
} from "@/hooks/useClientPosts";
import { useClientCore } from "@/context/ClientCoreContext";
import type { EditorialPost } from "@/types/client";

type CreatePostInput = Omit<EditorialPost, "id" | "createdAt" | "updatedAt">;
type UpdatePostInput = Partial<EditorialPost>;

export interface EditorialContextType {
  posts: EditorialPost[];
  postsByClient: Record<string, EditorialPost[]>;
  postsLoading: boolean;
  addPost: (post: CreatePostInput) => EditorialPost;
  updatePost: (id: string, updates: UpdatePostInput) => void;
  deletePost: (id: string) => void;
}

const EditorialContext = createContext<EditorialContextType | null>(null);

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function EditorialProvider({ children }: { children: ReactNode }) {
  const { activeClientId } = useClientCore();
  const { data: remotePosts = [], isLoading: postsLoading } = useClientPosts(activeClientId);
  const createPostMutation = useCreatePost(activeClientId);
  const updatePostMutation = useUpdatePost(activeClientId);
  const deletePostMutation = useDeletePost(activeClientId);

  const posts = activeClientId ? remotePosts : [];
  const postsByClient = useMemo(
    () => (activeClientId ? { [activeClientId]: posts } : {}),
    [activeClientId, posts],
  );

  const addPost = useCallback(
    (postInput: CreatePostInput): EditorialPost => {
      const timestamp = nowIso();
      const nextPost: EditorialPost = {
        ...postInput,
        id: makeId(),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      createPostMutation.mutate(postInput);
      return nextPost;
    },
    [createPostMutation],
  );

  const updatePost = useCallback(
    (id: string, updates: UpdatePostInput) => {
      updatePostMutation.mutate({ postId: id, updates });
    },
    [updatePostMutation],
  );

  const deletePost = useCallback(
    (id: string) => {
      deletePostMutation.mutate(id);
    },
    [deletePostMutation],
  );

  const value: EditorialContextType = {
    posts,
    postsByClient,
    postsLoading,
    addPost,
    updatePost,
    deletePost,
  };

  return (
    <EditorialContext.Provider value={value}>{children}</EditorialContext.Provider>
  );
}

export function useEditorial(): EditorialContextType {
  const ctx = useContext(EditorialContext);
  if (!ctx) {
    throw new Error("useEditorial must be used within EditorialProvider");
  }
  return ctx;
}
