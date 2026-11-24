cmake_minimum_required(VERSION 3.22.1)
project(molde_llm CXX C)

# llama.cpp (tag b12144) source tree; passed in by Gradle (-PllamaDir=... or env LLAMA_CPP_DIR)
set(LLAMA_DIR "" CACHE PATH "llama.cpp source directory")
if(NOT EXISTS "${LLAMA_DIR}/CMakeLists.txt")
  message(FATAL_ERROR "LLAMA_DIR does not point at a llama.cpp checkout: '${LLAMA_DIR}'")
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
set(CMAKE_SHARED_LINKER_FLAGS "${CMAKE_SHARED_LINKER_FLAGS} -Wl,-z,max-page-size=16384")

set(BUILD_SHARED_LIBS ON CACHE BOOL "" FORCE)
set(GGML_BACKEND_DL ON CACHE BOOL "" FORCE)          # CPU variants are loaded at run time by CPU features
set(GGML_CPU_ALL_VARIANTS ON CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(GGML_VULKAN OFF CACHE BOOL "" FORCE)
set(GGML_OPENCL OFF CACHE BOOL "" FORCE)
set(LLAMA_CURL OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_COMMON OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_WEBUI OFF CACHE BOOL "" FORCE)

add_subdirectory(${LLAMA_DIR} llama.cpp)

add_library(molde_llm SHARED molde_jni.cpp)
target_include_directories(molde_llm PRIVATE ${LLAMA_DIR}/include ${LLAMA_DIR}/ggml/include)
target_link_libraries(molde_llm PRIVATE llama ggml android log)
