FROM ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y wget && apt-get clean

RUN wget https://www.multichain.com/download/multichain-2.3.3.tar.gz && \
    tar -xvzf multichain-2.3.3.tar.gz && \
    mv multichain-2.3.3/multichain* /usr/local/bin/ && \
    rm -rf multichain-2.3.3*

WORKDIR /root