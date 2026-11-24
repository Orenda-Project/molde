plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// llama.cpp tag b12144 source tree (see README). Override with -PllamaDir=... or env LLAMA_CPP_DIR.
val llamaDir: String = (project.findProperty("llamaDir") as String?)
    ?: System.getenv("LLAMA_CPP_DIR")
    ?: (System.getProperty("user.home") + "/Documents/free_work/molde-model/train-setup/llama-src")

android {
    namespace = "com.oyekamal.molde"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = "28.2.13676358"

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.oyekamal.molde"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = 26
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        // one ABI per build keeps disk and time down: -Pabi=x86_64 (emulator, default) or -Pabi=arm64-v8a (phone)
        ndk { abiFilters += listOf((project.findProperty("abi") as String?) ?: "x86_64") }
        externalNativeBuild {
            cmake {
                arguments += listOf("-DLLAMA_DIR=" + llamaDir, "-DANDROID_STL=c++_shared", "-DCMAKE_BUILD_TYPE=Release")
            }
        }
    }
    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }
    packaging {
        // ggml loads its CPU variants by listing the native library directory, so the libraries must be extracted
        jniLibs { useLegacyPackaging = true }
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
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
