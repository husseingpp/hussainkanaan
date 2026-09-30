plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "net.hussainkanaan.quran_app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // flutter_local_notifications (daily ayah, khatmah reminders) uses
        // java.time, which needs core library desugaring below API 26.
        isCoreLibraryDesugaringEnabled = true
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "net.hussainkanaan.quran_app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    // The built-in reciter's Opus files are already compressed; storing them
    // uncompressed lets the player read and seek them straight from the APK.
    androidResources {
        noCompress += listOf("opus")
    }

    signingConfigs {
        create("test") {
            storeFile = file("../test-signing/quran-test.jks")
            storePassword = "quran-test-builds"
            keyAlias = "quran-test"
            keyPassword = "quran-test-builds"
        }
    }

    buildTypes {
        release {
            // Test builds: one fixed key so each APK updates over the last
            // (see android/test-signing/README.md). Not for store releases.
            signingConfig = signingConfigs.getByName("test")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
    // flutter_local_notifications' README: avoids a reported crash on
    // Android 12L+ when desugaring is enabled.
    implementation("androidx.window:window:1.0.0")
    implementation("androidx.window:window-java:1.0.0")
}
