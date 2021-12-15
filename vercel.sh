#!/bin/bash

# https://vercel.com/support/articles/how-do-i-use-the-ignored-build-step-field-on-vercel

# Only build main branch
echo $(git branch --show-current)
if [[ $(git branch --show-current) ==  "main" ]] ; then
  # Proceed with the build
  echo "✅ - Build can proceed"
  exit 1;

else
  # Don't build
  echo "🛑 - Build cancelled"
  exit 0;
fi
