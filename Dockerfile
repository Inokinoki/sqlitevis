# Use Ubuntu 24.04 as base image
FROM ubuntu:24.04

# Avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    make \
    curl \
    wget \
    unzip \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Emscripten SDK
RUN git clone https://github.com/emscripten-core/emsdk.git /opt/emsdk

# Activate Emscripten and install latest version
RUN cd /opt/emsdk && \
    ./emsdk install latest && \
    ./emsdk activate latest && \
    chmod +x ./emsdk_env.sh

# Source Emscripten environment and add to PATH
# Note: We'll activate it in the build step since ENV can't source shell scripts
ENV EMSDK="/opt/emsdk"

# Copy project files
COPY . .

# Set up project structure and build
# Source Emscripten environment before building
RUN bash -c "source /opt/emsdk/emsdk_env.sh && \
    make setup && \
    make download-sqlite && \
    make instrument && \
    make build-wasm"

# Expose the development server port
EXPOSE 8000

# Start the development server
# Serve from project root so files are accessible
CMD ["python3", "-m", "http.server", "8000", "--directory", "/app"]

