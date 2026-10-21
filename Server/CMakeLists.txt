# CMakeList.txt : CMake project for Server.
#
cmake_minimum_required (VERSION 3.8)

# Enable Hot Reload for MSVC compilers if supported.
if (POLICY CMP0141)
  cmake_policy(SET CMP0141 NEW)
  set(CMAKE_MSVC_DEBUG_INFORMATION_FORMAT "$<IF:$<AND:$<C_COMPILER_ID:MSVC>,$<CXX_COMPILER_ID:MSVC>>,$<$<CONFIG:Debug,RelWithDebInfo>:EditAndContinue>,$<$<CONFIG:Debug,RelWithDebInfo>:ProgramDatabase>>")
endif()

# Use the vcpkg submodule as toolchain unless one was given explicitly.
if (NOT DEFINED CMAKE_TOOLCHAIN_FILE)
  set(CMAKE_TOOLCHAIN_FILE "${CMAKE_CURRENT_SOURCE_DIR}/external/vcpkg/scripts/buildsystems/vcpkg.cmake" CACHE STRING "Vcpkg toolchain file")
endif()

project ("Server")

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(protobuf CONFIG REQUIRED)
find_package(gRPC CONFIG REQUIRED)

# Every .proto file in protos/ (git root) is compiled automatically.
get_filename_component(PROTO_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../protos" ABSOLUTE)
file(GLOB PROTO_FILES CONFIGURE_DEPENDS "${PROTO_DIR}/*.proto")
set(PROTO_OUT_DIR "${CMAKE_CURRENT_BINARY_DIR}/generated")
file(MAKE_DIRECTORY "${PROTO_OUT_DIR}")

add_library(proto OBJECT ${PROTO_FILES})
target_link_libraries(proto PUBLIC protobuf::libprotobuf gRPC::grpc++)
target_include_directories(proto PUBLIC "${PROTO_OUT_DIR}")

protobuf_generate(
  TARGET proto
  LANGUAGE cpp
  IMPORT_DIRS "${PROTO_DIR}"
  PROTOC_OUT_DIR "${PROTO_OUT_DIR}")

protobuf_generate(
  TARGET proto
  LANGUAGE grpc
  GENERATE_EXTENSIONS .grpc.pb.h .grpc.pb.cc
  PLUGIN "protoc-gen-grpc=$<TARGET_FILE:gRPC::grpc_cpp_plugin>"
  IMPORT_DIRS "${PROTO_DIR}"
  PROTOC_OUT_DIR "${PROTO_OUT_DIR}")

# Every source in src/ and header in include/ is picked up automatically.
file(GLOB_RECURSE SOURCES CONFIGURE_DEPENDS "src/*.cpp")
file(GLOB_RECURSE HEADERS CONFIGURE_DEPENDS "include/*.h" "include/*.hpp")

add_executable(Server ${SOURCES} ${HEADERS})
target_include_directories(Server PRIVATE include)
target_link_libraries(Server PRIVATE proto)
