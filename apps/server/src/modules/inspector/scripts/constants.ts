/** in-page overlay가 클릭 요소 정보를 서버로 보내는 바인딩 이름 */
export const BINDING_NAME = '__jcInspect';

/** Network 패널이 사용하는 노출 바인딩 이름 */
export const NET_BINDINGS = {
  sync: '__jcNetSync',
  body: '__jcNetBody',
  clear: '__jcNetClear',
} as const;

/** Console 패널이 사용하는 노출 바인딩 이름 */
export const CONSOLE_BINDINGS = {
  sync: '__jcConsoleSync',
  clear: '__jcConsoleClear',
  open: '__jcConsoleOpen',
} as const;
