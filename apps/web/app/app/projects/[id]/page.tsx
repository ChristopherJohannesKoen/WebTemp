import { forbidden, notFound } from 'next/navigation';
import { ProjectDetailClient } from '../../../../components/project-detail-client';
import { ApiRequestError } from '../../../../lib/api-error';
import { getProject } from '../../../../lib/server-api';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProjectDetailPage({
  params,
  searchParams
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const forceError = getSingleValue(resolvedSearchParams.forceError);
  const queryParams = new URLSearchParams();

  if (process.env.TEMPLATE_E2E === 'true' && forceError === 'upstream') {
    queryParams.set('forceError', 'upstream');
  }

  try {
    const project = await getProject(id, queryParams.toString());

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
