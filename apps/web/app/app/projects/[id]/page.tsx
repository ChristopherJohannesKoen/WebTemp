import { forbidden, notFound } from 'next/navigation';
import { ProjectDetailClient } from '../../../../components/project-detail-client';
import { ApiRequestError } from '../../../../lib/api-error';
import { getProject } from '../../../../lib/server-api';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

export default async function ProjectDetailPage({
  params
}: {
  params: Params;
}) {
  const { id } = await params;

  try {
    const project = await getProject(id);

    return <ProjectDetailClient project={project} />;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (error.statusCode === 404) {
        notFound();
      }

      if (error.statusCode === 403) {
        forbidden();
      }
    }

    throw error;
  }
}
