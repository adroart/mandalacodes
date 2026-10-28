// The personal iPhone build keeps its profile locally; website account sessions
// are deliberately not shared with the bundled app's separate origin.
export const LAUNCH_FLAGS = { accounts: false, hologeneticProfile: true, relationsStack: true };
