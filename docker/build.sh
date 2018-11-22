#!/bin/bash
mkdir files
cp ../*.json files
cp ../*.js files
docker build -t token-splitter .
rm -fr files
