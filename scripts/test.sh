#!/usr/bin/env bash

set -o errexit
set -o pipefail
set -o nounset

script_dir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
readonly script_dir

cd "${script_dir}"/..
yarn install

pushd piilop
yarn install
popd


# just build
# cd dist
# npm link
# popd

pushd tests/examples/hello-world
# npm link piilop
yarn install
just check
just run test
just run test --testName Apps
just run test --testName Containers
popd