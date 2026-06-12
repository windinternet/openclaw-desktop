interface ArtifactAPI {
  getMeta: (artifactId: string) => Promise<unknown>;
  requestAuth: (artifactId: string, capability: string, detail: string) => Promise<{ granted: boolean; level: string }>;
}

function getApi(): ArtifactAPI {
  const api = (window as unknown as { electronAPI?: { artifact?: ArtifactAPI } }).electronAPI?.artifact;
  if (!api) throw new Error('electronAPI.artifact not available');
  return api;
}

export const authService = {
  async requestAuthorization(
    artifactId: string,
    capability: string,
    detail: string,
  ): Promise<string | null> {
    const api = getApi();
    const result = await api.requestAuth(artifactId, capability, detail);
    return result.granted ? result.level : null;
  },
};
