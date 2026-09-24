// Config plugin: inyecta la firma de release en android/app/build.gradle durante
// el prebuild, leyendo android/keystore.properties (keystore de subida de EAS).
// Así `expo prebuild` SIEMPRE genera un build.gradle que puede firmar para Play,
// sin editar a mano. Si no existe keystore.properties, el release cae a debug
// (apk instalable para probar, NO subible a Play). Idempotente.
//
// Ver android/keystore.properties.example y el memory project_local_android_build.

const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

// El build LOCAL en frío (recompila todo) agota la metaspace default del daemon
// de Gradle (2 GB heap / 512 MB metaspace) → "Gradle build daemon disappeared".
// Subimos heap + metaspace. En EAS no aplica (guard abajo).
const JVM_ARGS = '-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8';

const LOADER = `// [withReleaseSigning] firma de release desde android/keystore.properties (si existe)
def keystorePropsFile = rootProject.file("keystore.properties")
def keystoreProps = new Properties()
if (keystorePropsFile.exists()) {
    keystoreProps.load(new FileInputStream(keystorePropsFile))
}

android {`;

const SIGNING_CONFIGS = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (keystorePropsFile.exists()) {
                storeFile rootProject.file(keystoreProps['storeFile'])
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
    }`;

module.exports = function withReleaseSigning(config) {
  // En EAS Build NO tocamos nada: EAS maneja la firma con sus propias
  // credenciales remotas (el flujo que ya sube a Play). Solo aplicamos en
  // prebuild local. EAS setea EAS_BUILD=true durante su build/prebuild.
  if (process.env.EAS_BUILD === 'true') return config;

  // Subir memoria del daemon de Gradle (gradle.properties).
  config = withGradleProperties(config, (cfg) => {
    const key = 'org.gradle.jvmargs';
    const existing = cfg.modResults.find((p) => p.type === 'property' && p.key === key);
    if (existing) existing.value = JVM_ARGS;
    else cfg.modResults.push({ type: 'property', key, value: JVM_ARGS });
    return cfg;
  });

  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;

    // 1) Loader de keystore.properties antes del `android {` de nivel superior.
    if (!g.includes('[withReleaseSigning]')) {
      g = g.replace(/^android \{/m, LOADER);
    }

    // 2) Sumar el signingConfig `release` al bloque signingConfigs. Guard
    //    específico (el genérico matcheaba el `release {` de buildTypes).
    if (!g.includes("keystoreProps['storeFile']")) {
      g = g.replace(
        /    signingConfigs \{\s*debug \{[\s\S]*?keyPassword 'android'\s*\}\s*\}/,
        SIGNING_CONFIGS,
      );
    }

    // 3) El buildType release usa la firma release si hay keystore (anclado al
    //    comentario "Caution" que solo está en el release buildType).
    g = g.replace(
      /(\/\/ Caution! In production[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig keystorePropsFile.exists() ? signingConfigs.release : signingConfigs.debug',
    );

    cfg.modResults.contents = g;
    return cfg;
  });
};
