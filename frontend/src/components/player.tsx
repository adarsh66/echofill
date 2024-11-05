// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export class Player {
  private playbackNode: AudioWorkletNode | null = null;
  private audioContext: AudioContext | null = null;
  private isPaused: boolean = false;

  async init(sampleRate: number) {
    this.audioContext = new AudioContext({ sampleRate });
    await this.audioContext.audioWorklet.addModule("playback-worklet.js");

    this.playbackNode = new AudioWorkletNode(this.audioContext, "playback-worklet");
    this.playbackNode.connect(this.audioContext.destination);
  }

  play(buffer: Int16Array) {
    if (this.playbackNode && !this.isPaused) {
      this.playbackNode.port.postMessage(buffer);
    }
  }

  clear() {
    if (this.playbackNode) {
      this.playbackNode.port.postMessage(null);
    }
  }

  pause() {
    this.isPaused = true;
    if (this.audioContext) {
      this.audioContext.suspend();
    }
  }

  resume() {
    this.isPaused = false;
    if (this.audioContext) {
      this.audioContext.resume();
    }
  }

  stop() {
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.playbackNode = null;
    this.audioContext = null;
  }
}