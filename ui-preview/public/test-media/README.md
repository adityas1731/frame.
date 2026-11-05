# Frame original media fixtures

The test-pattern video, low-volume synthetic sine tones and subtitle text were created for Frame using the already-installed Jellyfin FFmpeg encoder. No media was read from a Jellyfin library or Jeva. Frame's authors dedicate these original test assets to CC0-1.0. No FFmpeg executable is redistributed.

30 seconds, 640×360, 24 fps, H.264 High level 4.0, 8-bit SDR, two stereo AAC tracks. The HLS fixture is a stream-copy repackaging of the same original clip. These assets exercise browser decoding and mocked Jellyfin transport; they are not proof of playback from the production server.

`alternate.m3u8` and `alternate-*.ts` are stream-copy derivatives selecting the 660 Hz second AAC track from the same MP4. The normal HLS files select 440 Hz. These permit later verification that alternate-audio selection changes the actual audio stream. They do not represent live server conversion.
