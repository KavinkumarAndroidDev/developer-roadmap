import { getUrlParams } from '../../lib/browser';
import { useEffect, useState } from 'react';
import type { TeamDocument } from '../CreateTeam/CreateTeamForm';
import type { TeamResourceConfig } from '../CreateTeam/RoadmapSelector';
import { httpGet, httpPut } from '../../lib/http';
import { pageProgressMessage } from '../../stores/page';
import ExternalLinkIcon from '../../icons/external-link.svg';
import RoadmapIcon from '../../icons/roadmap.svg';
import PlusIcon from '../../icons/plus.svg';
import type { PageType } from '../CommandMenu/CommandMenu';
import { UpdateTeamResourceModal } from '../CreateTeam/UpdateTeamResourceModal';
import { useStore } from '@nanostores/react';
import { $canManageCurrentTeam, $currentTeam } from '../../stores/team';
import { useToast } from '../../hooks/use-toast';
import { SelectRoadmapModal } from '../CreateTeam/SelectRoadmapModal';
import { PickRoadmapOptionModal } from '../TeamRoadmaps/PickRoadmapOptionModal';
import type { AllowedRoadmapVisibility } from '../CustomRoadmap/CreateRoadmap/CreateRoadmapModal';
import { CreateRoadmapModal } from '../CustomRoadmap/CreateRoadmap/CreateRoadmapModal';
import {
  ExternalLink,
  Globe,
  LockIcon,
  type LucideIcon,
  PenSquare,
  Shapes,
  Users,
} from 'lucide-react';
import { RoadmapActionDropdown } from './RoadmapActionDropdown';

export function TeamRoadmaps() {
  const { t: teamId } = getUrlParams();

  const canManageCurrentTeam = useStore($canManageCurrentTeam);

  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [removingRoadmapId, setRemovingRoadmapId] = useState<string>('');
  const [isPickingOptions, setIsPickingOptions] = useState(false);
  const [isAddingRoadmap, setIsAddingRoadmap] = useState(false);
  const [isCreatingRoadmap, setIsCreatingRoadmap] = useState(false);
  const [changingRoadmapId, setChangingRoadmapId] = useState<string>('');
  const [team, setTeam] = useState<TeamDocument>();
  const [teamResources, setTeamResources] = useState<TeamResourceConfig>([]);
  const [allRoadmaps, setAllRoadmaps] = useState<PageType[]>([]);

  async function loadAllRoadmaps() {
    const { error, response } = await httpGet<PageType[]>(`/pages.json`);

    if (error) {
      toast.error(error.message || 'Something went wrong');
      return;
    }

    if (!response) {
      return [];
    }

    const allRoadmaps = response
      .filter((page) => page.group === 'Roadmaps')
      .sort((a, b) => {
        if (a.title === 'Android') return 1;
        return a.title.localeCompare(b.title);
      });

    setAllRoadmaps(allRoadmaps);
    return response;
  }

  async function loadTeam(teamIdToFetch: string) {
    const { response, error } = await httpGet<TeamDocument>(
      `${import.meta.env.PUBLIC_API_URL}/v1-get-team/${teamIdToFetch}`
    );

    if (error || !response) {
      toast.error('Error loading team');
      window.location.href = '/account';
      return;
    }

    setTeam(response);
  }

  async function loadTeamResourceConfig(teamId: string) {
    const { error, response } = await httpGet<TeamResourceConfig>(
      `${import.meta.env.PUBLIC_API_URL}/v1-get-team-resource-config/${teamId}`
    );
    if (error || !Array.isArray(response)) {
      console.error(error);
      return;
    }

    setTeamResources(response);
  }

  useEffect(() => {
    if (!teamId) {
      return;
    }

    setIsLoading(true);
    Promise.all([
      loadTeam(teamId),
      loadTeamResourceConfig(teamId),
      loadAllRoadmaps(),
    ]).finally(() => {
      pageProgressMessage.set('');
      setIsLoading(false);
    });
  }, [teamId]);

  async function deleteResource(roadmapId: string) {
    if (!team?._id) {
      return;
    }

    toast.loading('Deleting roadmap');
    pageProgressMessage.set(`Deleting roadmap from team`);
    const { error, response } = await httpPut<TeamResourceConfig>(
      `${import.meta.env.PUBLIC_API_URL}/v1-delete-team-resource-config/${
        team._id
      }`,
      {
        resourceId: roadmapId,
        resourceType: 'roadmap',
      }
    );

    if (error || !response) {
      toast.error(error?.message || 'Something went wrong');
      return;
    }

    toast.success('Roadmap removed');
    setTeamResources(response);
  }

  async function onAdd(roadmapId: string) {
    if (!teamId) {
      return;
    }

    toast.loading('Adding roadmap');
    pageProgressMessage.set('Adding roadmap');
    setIsLoading(true);
    const { error, response } = await httpPut<TeamResourceConfig>(
      `${
        import.meta.env.PUBLIC_API_URL
      }/v1-update-team-resource-config/${teamId}`,
      {
        teamId: teamId,
        resourceId: roadmapId,
        resourceType: 'roadmap',
        removed: [],
      }
    );

    if (error || !response) {
      toast.error(error?.message || 'Error adding roadmap');
      return;
    }

    setTeamResources(response);
    toast.success('Roadmap added');
  }

  async function onRemove(resourceId: string) {
    pageProgressMessage.set('Removing roadmap');

    deleteResource(resourceId).finally(() => {
      pageProgressMessage.set('');
    });
  }

  useEffect(() => {
    function handleCustomRoadmapCreated(event: Event) {
      const { roadmapId } = (event as CustomEvent)?.detail;
      if (!roadmapId) {
        return;
      }

      loadAllRoadmaps().finally(() => {});
      onAdd(roadmapId).finally(() => {
        pageProgressMessage.set('');
      });
    }
    window.addEventListener(
      'custom-roadmap-created',
      handleCustomRoadmapCreated
    );

    return () => {
      window.removeEventListener(
        'custom-roadmap-created',
        handleCustomRoadmapCreated
      );
    };
  }, []);

  if (!team) {
    return null;
  }

  const pickRoadmapOptionModal = isPickingOptions && (
    <PickRoadmapOptionModal
      onClose={() => setIsPickingOptions(false)}
      showDefaultRoadmapsModal={() => {
        setIsAddingRoadmap(true);
        setIsPickingOptions(false);
      }}
      showCreateCustomRoadmapModal={() => {
        setIsCreatingRoadmap(true);
        setIsPickingOptions(false);
      }}
    />
  );

  const addRoadmapModal = isAddingRoadmap && (
    <SelectRoadmapModal
      onClose={() => setIsAddingRoadmap(false)}
      teamResourceConfig={teamResources}
      allRoadmaps={allRoadmaps}
      teamId={teamId}
      onRoadmapAdd={(roadmapId: string) => {
        onAdd(roadmapId).finally(() => {
          pageProgressMessage.set('');
        });
      }}
      onRoadmapRemove={(roadmapId: string) => {
        if (confirm('Are you sure you want to remove this roadmap?')) {
          onRemove(roadmapId).finally(() => {});
        }
      }}
    />
  );

  const createRoadmapModal = isCreatingRoadmap && (
    <CreateRoadmapModal
      teamId={teamId}
      onClose={() => {
        setIsCreatingRoadmap(false);
      }}
      onCreated={() => {
        loadTeamResourceConfig(teamId).finally(() => null);
        setIsCreatingRoadmap(false);
      }}
    />
  );

  if (teamResources.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center p-4 py-20">
        {pickRoadmapOptionModal}
        {addRoadmapModal}
        {createRoadmapModal}

        <img
          alt="roadmap"
          src={RoadmapIcon.src}
          className="mb-4 h-24 w-24 opacity-10"
        />
        <h3 className="mb-1 text-2xl font-bold text-gray-900">No roadmaps</h3>
        <p className="text-base text-gray-500">
          {canManageCurrentTeam
            ? 'Add a roadmap to start tracking your team'
            : 'Ask your team admin to add some roadmaps'}
        </p>

        {canManageCurrentTeam && (
          <button
            className="mt-4 rounded-lg bg-black px-4 py-2 font-medium text-white hover:bg-gray-900"
            onClick={() => setIsPickingOptions(true)}
          >
            Add roadmap
          </button>
        )}
      </div>
    );
  }

  const placeholderRoadmaps = teamResources.filter(
    (c: TeamResourceConfig[0]) => c.isCustomResource && !c.topics
  );
  const customRoadmaps = teamResources.filter(
    (c: TeamResourceConfig[0]) => c.isCustomResource && c.topics
  );
  const defaultRoadmaps = teamResources.filter(
    (c: TeamResourceConfig[0]) => !c.isCustomResource
  );

  console.log({ placeholderRoadmaps, customRoadmaps, defaultRoadmaps });

  return (
    <div>
      {pickRoadmapOptionModal}
      {addRoadmapModal}
      {createRoadmapModal}

      {placeholderRoadmaps.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs uppercase text-gray-400">
            Placeholder Roadmaps
          </h3>
          <div className="flex flex-col divide-y rounded-md border">
            {placeholderRoadmaps.map(
              (resourceConfig: TeamResourceConfig[0]) => {
                return (
                  <div
                    className="grid grid-cols-1 sm:grid-cols-[auto_173px] p-2.5"
                    key={resourceConfig.resourceId}
                  >
                    <div className='grid mb-3 sm:mb-0'>
                      <p className="text-base font-medium leading-tight text-black truncate mb-1.5">
                        {resourceConfig.title}
                      </p>
                      <span className="text-xs italic leading-none text-gray-400/60">
                        Placeholder roadmap
                      </span>
                    </div>

                    {canManageCurrentTeam && (
                      <div className="flex items-center justify-start sm:justify-end gap-2">
                        <RoadmapActionDropdown
                          onDelete={() => {
                            if (
                              confirm(
                                'Are you sure you want to remove this roadmap?'
                              )
                            ) {
                              onRemove(resourceConfig.resourceId).finally(
                                () => {}
                              );
                            }
                          }}
                        />
                        <a
                          href={`${import.meta.env.PUBLIC_EDITOR_APP_URL}/${
                            resourceConfig.resourceId
                          }`}
                          className={
                            'flex gap-2 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs hover:bg-gray-50 focus:outline-none'
                          }
                          target={'_blank'}
                        >
                          <PenSquare className="inline-block h-4 w-4" />
                          Create Roadmap
                        </a>
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}

      {placeholderRoadmaps.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs uppercase text-gray-400">
            Custom Roadmaps
          </h3>
          <div className="flex flex-col divide-y rounded-md border">
            {customRoadmaps.map((resourceConfig: TeamResourceConfig[0]) => {
              const editorLink = `${import.meta.env.PUBLIC_EDITOR_APP_URL}/${
                resourceConfig.resourceId
              }`;

              return (
                <div className="grid grid-cols-1 sm:grid-cols-[auto_110px] p-2.5">
                  <div className="grid grid-cols-1 mb-3 sm:mb-0">
                    <p className="mb-1.5 truncate text-base font-medium leading-tight text-black">
                      {resourceConfig.title}
                    </p>
                    <span className="flex items-center text-xs leading-none text-gray-400">
                      <VisibilityBadge
                        visibility={resourceConfig.visibility!}
                      />
                      <span className="mx-2 font-semibold">&middot;</span>
                      <Shapes size={16} className="mr-1 inline-block h-4 w-4" />
                      {resourceConfig.topics} topic
                    </span>
                  </div>
                  <div className="mr-1 flex items-center justify-start sm:justify-end">
                    {canManageCurrentTeam && (
                      <RoadmapActionDropdown
                        onEdit={() => {
                          window.open(editorLink, '_blank');
                        }}
                        onDelete={() => {
                          if (
                            confirm(
                              'Are you sure you want to remove this roadmap?'
                            )
                          ) {
                            onRemove(resourceConfig.resourceId).finally(
                              () => {}
                            );
                          }
                        }}
                      />
                    )}

                    <a
                      href={`/r?id=${resourceConfig.resourceId}`}
                      className={
                        'ml-2 flex items-center gap-2 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs hover:bg-gray-50 focus:outline-none'
                      }
                      target={'_blank'}
                    >
                      <ExternalLink className="inline-block h-4 w-4" />
                      Visit
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <span className={'text-gray-400'}>
          {teamResources.length} roadmap(s) selected
        </span>
        {canManageCurrentTeam && (
          <button
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-gray-500 underline hover:bg-gray-100 hover:text-gray-900"
            onClick={() => setIsPickingOptions(true)}
          >
            Add / Remove Roadmaps
          </button>
        )}
      </div>
      <div className={'grid grid-cols-1 gap-3 sm:grid-cols-2'}>
        {changingRoadmapId && (
          <UpdateTeamResourceModal
            onClose={() => setChangingRoadmapId('')}
            resourceId={changingRoadmapId}
            resourceType={'roadmap'}
            teamId={team?._id!}
            setTeamResourceConfig={setTeamResources}
            defaultRemovedItems={
              teamResources.find(
                (c: TeamResourceConfig[0]) => c.resourceId === changingRoadmapId
              )?.removed || []
            }
          />
        )}

        {teamResources.map((resourceConfig: TeamResourceConfig[0]) => {
          const {
            title: roadmapTitle,
            visibility,
            isCustomResource,
            resourceId,
            removed: removedTopics,
            topics,
          } = resourceConfig;

          const url = isCustomResource
            ? `/r?id=${resourceId}`
            : `/${resourceId}?t=${teamId}`;

          return (
            <div
              key={resourceId}
              className="flex flex-col items-start rounded-md border border-gray-300"
            >
              {visibility === 'me' && (
                <div className="-mb-1 px-3 pt-3">
                  <VisibilityBadge visibility={visibility!} />
                </div>
              )}
              <div className={'w-full flex-grow px-3 py-4'}>
                <a
                  href={url}
                  className="group mb-0.5 flex items-center gap-2 text-base font-medium leading-tight text-black"
                  target={'_blank'}
                >
                  {roadmapTitle}
                  <img
                    alt={'link'}
                    src={ExternalLinkIcon.src}
                    className="ml-auto h-4 w-4 opacity-20 transition-opacity group-hover:opacity-100"
                  />
                </a>
                {removedTopics.length > 0 || (topics && topics > 0) ? (
                  <span className={'text-xs leading-none text-gray-900'}>
                    {isCustomResource ? (
                      <>
                        {topics} topic{topics && topics > 1 ? 's' : ''}
                      </>
                    ) : (
                      <>
                        {removedTopics.length} topic
                        {removedTopics.length > 1 ? 's' : ''} removed
                      </>
                    )}
                  </span>
                ) : (
                  <span className="text-xs italic leading-none text-gray-400/60">
                    {isCustomResource
                      ? 'Placeholder roadmap'
                      : 'No changes made ..'}
                  </span>
                )}
              </div>

              {canManageCurrentTeam && (
                <div className={'flex w-full justify-between px-3 pb-3 pt-2'}>
                  <button
                    type="button"
                    className={
                      'text-xs text-gray-500 underline hover:text-black focus:outline-none'
                    }
                    onClick={() => {
                      if (isCustomResource) {
                        // Open the roadmap in a new tab
                        window.open(
                          `${
                            import.meta.env.PUBLIC_EDITOR_APP_URL
                          }/${resourceId}`,
                          '_blank'
                        );
                        return;
                      }
                      setRemovingRoadmapId('');
                      setChangingRoadmapId(resourceId);
                    }}
                  >
                    Customize
                  </button>

                  {removingRoadmapId !== resourceId && (
                    <button
                      type="button"
                      className={
                        'text-xs text-red-500 underline hover:text-black focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-red-500'
                      }
                      onClick={() => setRemovingRoadmapId(resourceId)}
                    >
                      Remove
                    </button>
                  )}

                  {removingRoadmapId === resourceId && (
                    <span className="text-xs">
                      Are you sure?{' '}
                      <button
                        onClick={() => onRemove(resourceId)}
                        className="mx-0.5 text-red-500 underline underline-offset-1"
                      >
                        Yes
                      </button>{' '}
                      <button
                        onClick={() => setRemovingRoadmapId('')}
                        className="text-red-500 underline underline-offset-1"
                      >
                        No
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {canManageCurrentTeam && (
          <button
            onClick={() => setIsPickingOptions(true)}
            className="group flex min-h-[110px] flex-col items-center justify-center rounded-md border border-dashed border-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-50"
          >
            <img
              alt="add"
              src={PlusIcon.src}
              className="mb-1 h-6 w-6 opacity-20 transition-opacity group-hover:opacity-100"
            />
            <span className="text-sm text-gray-400 transition-colors focus:outline-none group-hover:text-black">
              Add Roadmap
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

type VisibilityLabelProps = {
  visibility: AllowedRoadmapVisibility;
};

const visibilityDetails: Record<
  AllowedRoadmapVisibility,
  {
    icon: LucideIcon;
    label: string;
  }
> = {
  public: {
    icon: Globe,
    label: 'Public',
  },
  me: {
    icon: LockIcon,
    label: 'Only me',
  },
  team: {
    icon: Users,
    label: 'Team can View',
  },
  friends: {
    icon: Users,
    label: 'Friends',
  },
} as const;

function VisibilityBadge(props: VisibilityLabelProps) {
  const { visibility } = props;

  const { label, icon: Icon } = visibilityDetails[visibility];

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-normal`}
    >
      <Icon className="inline-block h-3 w-3" />
      {label}
    </span>
  );
}