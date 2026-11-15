# Frame original media fixtures

The test-pattern video, low-volume synthetic sine tones and subtitle text were created for Frame using the already-installed Jellyfin FFmpeg encoder. No media was read from a Jellyfin library or Jeva. Frame's authors dedicate these original test assets to CC0-1.0. No FFmpeg executable is redistributed.

30 seconds, 640×360, 24 fps, H.264 High level 4.0, 8-bit SDR, two stereo AAC tracks. The HLS fixture is a stream-copy repackaging of the same original clip. These assets exercise browser decoding and mocked Jellyfin transport; they are not proof of playback from the production server.

`alternate.m3u8` and `alternate-*.ts` are stream-copy derivatives selecting the 660 Hz second AAC track from the same MP4. The normal HLS files select 440 Hz. These permit later verification that alternate-audio selection changes the actual audio stream. They do not represent live server conversion.

`frame-audio.mp3` is 30 seconds of generated silence (44.1 kHz stereo, 32 kbps MP3), created with `ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 30 -codec:a libmp3lame -b:a 32k frame-audio.mp3`. It exercises native audio decoding and authenticated byte-range requests in the development fixture. It is original CC0 test media, excluded from release assets.
