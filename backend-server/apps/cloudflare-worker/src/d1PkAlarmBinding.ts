export const D1_PK_ALARM_NAME = "yugm-d1-pk-deadlines";

export interface D1PkAlarmStub {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface D1PkAlarmBindingEnv {
  PK_DEADLINES?: {
    idFromName(name: string): string;
    get(id: string): D1PkAlarmStub;
  };
}

export function pkAlarmStub(env: D1PkAlarmBindingEnv) {
  const binding = env.PK_DEADLINES;
  if (!binding) return undefined;
  return binding.get(binding.idFromName(D1_PK_ALARM_NAME));
}

export async function wakePkAlarm(env: D1PkAlarmBindingEnv, fallbackDue?: number): Promise<void> {
  const stub = pkAlarmStub(env);
  if (!stub) return;
  const path = fallbackDue === undefined ? "/schedule" : `/fallback?due=${fallbackDue}`;
  await stub.fetch(new Request(`https://pk-alarm${path}`, { method: "POST" }));
}
