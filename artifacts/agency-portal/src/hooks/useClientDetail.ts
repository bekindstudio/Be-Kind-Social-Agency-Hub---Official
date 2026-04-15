import { useQueryClient } from "@tanstack/react-query";
import {
  getGetClientQueryKey,
  getListProjectsQueryKey,
  getListTasksQueryKey,
  useCreateProject,
  useCreateTask,
  useGetClient,
  useListProjects,
  useListTasks,
  useListTeamMembers,
  useUpdateClient,
} from "@workspace/api-client-react";

export function useClientDetail(clientId: number) {
  const queryClient = useQueryClient();

  const { data: client, isLoading } = useGetClient(clientId, {
    query: { queryKey: getGetClientQueryKey(clientId), enabled: !!clientId },
  });
  const { data: projects } = useListProjects(
    { clientId },
    { query: { queryKey: getListProjectsQueryKey({ clientId }) } },
  );
  const { data: tasks } = useListTasks(
    {},
    { query: { queryKey: getListTasksQueryKey({}) } },
  );
  const { data: teamMembers } = useListTeamMembers();

  const updateClient = useUpdateClient();
  const createProject = useCreateProject();
  const createTask = useCreateTask();

  const invalidateClient = () =>
    queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
  const invalidateProjects = () =>
    queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey({ clientId }) });
  const invalidateTasks = () =>
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({}) });

  return {
    client,
    isLoading,
    projects,
    tasks,
    teamMembers,
    updateClient,
    createProject,
    createTask,
    invalidateClient,
    invalidateProjects,
    invalidateTasks,
  };
}
