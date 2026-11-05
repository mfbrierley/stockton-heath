// Web stand-in for utils/metaSdk.ts. Metro picks this file for web builds,
// and the phone apps keep the real one.
//
// Meta's SDK (react-native-fbsdk-next) has no web version: importing it calls
// requireNativeComponent, which React Native for web doesn't have. The app
// isn't published on the web, but `eas update` exports a web bundle alongside
// the iOS and Android ones (and `app.json` has `web.output: "static"`, so it
// renders every screen in Node), and with the real file that export failed -
// which stopped every over-the-air update. It also broke `expo start --web`.
export const startMetaSdk = async (): Promise<void> => {};
