#!/bin/bash

rm -rf dist

electron-builder --mac

electron-builder --win

electron-builder --linux