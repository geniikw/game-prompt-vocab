// Builds an installable APK without Gradle/Android Studio.
// Needs: aapt, dx (dalvik-exchange), zipalign, apksigner, javac, keytool, android.jar (API 23+).
// Ubuntu: apt-get install android-sdk-platform-23 aapt apksigner zipalign dalvik-exchange
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const and = path.join(root, 'android');
const build = path.join(root, 'build', 'apk');
const ANDROID_JAR = process.env.ANDROID_JAR || '/usr/lib/android-sdk/platforms/android-23/android.jar';
const DX = process.env.DX || '/usr/lib/android-sdk/build-tools/debian/dx';
const KS = process.env.KEYSTORE || path.join(root, 'keystore', 'release.jks');
const KS_PASS = process.env.KEYSTORE_PASS;
if (!KS_PASS) { console.error('KEYSTORE_PASS 환경 변수를 설정하세요.'); process.exit(1); }
const OUT = process.env.APK_OUT || path.join(root, 'game-terms.apk');

const sh = (cmd, cwd = root) => { console.log('$ ' + cmd); execSync(cmd, { cwd, stdio: 'inherit' }); };

if (!process.argv.includes('--skip-web')) {
  sh('node scripts/gen-data.mjs');
  sh('npm run build');
}
fs.rmSync(build, { recursive: true, force: true });
for (const d of ['assets', 'gen', 'classes']) fs.mkdirSync(path.join(build, d), { recursive: true });
fs.copyFileSync(path.join(root, 'dist', 'index.html'), path.join(build, 'assets', 'index.html'));

sh(`aapt package -f -0 arsc -M "${and}/AndroidManifest.xml" -S "${and}/res" -A "${build}/assets" -I "${ANDROID_JAR}" -J "${build}/gen" -F "${build}/unaligned.apk"`);
const javaFiles = execSync(`find "${and}/src" "${build}/gen" -name '*.java'`).toString().trim().split('\n').map((f) => `"${f}"`).join(' ');
sh(`javac -nowarn --release 8 -encoding UTF-8 -cp "${ANDROID_JAR}" -d "${build}/classes" ${javaFiles} 2>&1 | grep -v 'warning' || true`);
sh(`"${DX}" --dex --output="${build}/classes.dex" "${build}/classes"`);
sh(`aapt add -f unaligned.apk classes.dex`, build);
sh(`zipalign -f -p 4 unaligned.apk aligned.apk`, build);

if (!fs.existsSync(KS)) {
  fs.mkdirSync(path.dirname(KS), { recursive: true });
  sh(`keytool -genkeypair -v -keystore "${KS}" -alias gameterms -keyalg RSA -keysize 2048 -validity 10000 -storepass ${KS_PASS} -keypass ${KS_PASS} -dname "CN=Game Terms, O=Personal, C=KR"`);
}
sh(`apksigner sign --ks "${KS}" --ks-pass pass:${KS_PASS} --ks-key-alias gameterms --out "${OUT}" "${build}/aligned.apk"`);
sh(`apksigner verify --print-certs "${OUT}" | head -3`);
console.log('\nAPK: ' + OUT + ' (' + Math.round(fs.statSync(OUT).size / 1024) + ' KB)');
