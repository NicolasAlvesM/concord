// Quando baixar/instalar atualizações. Puro para poder testar.

/** Atualização já baixada aparece em poucos segundos após abrir o app. */
const STARTUP_WINDOW_MS = 30_000

/** Não baixa em chamada: o upload do servidor é o mesmo que leva a mídia. */
export function canDownloadUpdate(inCall: boolean): boolean {
  return !inCall
}

/**
 * Instala sozinho só logo ao abrir (estava baixada da sessão anterior).
 * Depois disso, só pelo aviso "Nova atualização disponível".
 */
export function installOnStartup(state: { msSinceStart: number; inCall: boolean }): boolean {
  return !state.inCall && state.msSinceStart <= STARTUP_WINDOW_MS
}
