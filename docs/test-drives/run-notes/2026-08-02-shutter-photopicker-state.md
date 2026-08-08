# Emulator state capture — 2026-08-02, shutter-opens-photopicker bug (issue #140)

Git state: branch `ci-security-and-commitlint-checks`, commit `5dcd4fa720054337d3a18916483b8c0a0946e891`.

## Foreground activity

```
    topResumedActivity=ActivityRecord{4a02dfe u0 com.google.android.providers.media.module/com.android.providers.media.photopicker.PhotoPickerUserSelectActivity t41}
```

## App process

```
15680
```

## dumpsys location (feralspotter entries)

```
(none)
```

## Recent logcat (last 80 lines, pid 15680)

```
08-02 17:37:38.458 W/Choreographer(15680): Frame time is 0.851578 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:38.508 W/Choreographer(15680): Frame time is 0.655011 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:38.525 W/Choreographer(15680): Frame time is 0.325062 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:38.542 W/Choreographer(15680): Frame time is 0.144986 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:39.044 W/Choreographer(15680): Frame time is 0.185416 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:39.291 W/Choreographer(15680): Frame time is 0.314707 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:40.308 W/Choreographer(15680): Frame time is 0.237969 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:40.325 W/Choreographer(15680): Frame time is 0.239299 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:40.342 W/Choreographer(15680): Frame time is 0.076154 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:40.708 W/Choreographer(15680): Frame time is 0.424453 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:40.825 W/Choreographer(15680): Frame time is 0.215398 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:40.875 W/Choreographer(15680): Frame time is 0.556141 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:42.075 W/Choreographer(15680): Frame time is 0.145067 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:42.408 W/Choreographer(15680): Frame time is 0.025925 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:43.825 W/Choreographer(15680): Frame time is 0.498587 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:43.942 W/Choreographer(15680): Frame time is 0.206684 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:44.725 W/Choreographer(15680): Frame time is 0.101358 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:45.991 W/Choreographer(15680): Frame time is 0.669889 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.025 W/Choreographer(15680): Frame time is 0.342757 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.125 W/Choreographer(15680): Frame time is 0.342751 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.158 W/Choreographer(15680): Frame time is 0.671625 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.174 W/Choreographer(15680): Frame time is 0.648069 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.191 W/Choreographer(15680): Frame time is 0.991588 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.208 W/Choreographer(15680): Frame time is 0.442007 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.258 W/Choreographer(15680): Frame time is 0.418073 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.275 W/Choreographer(15680): Frame time is 0.500417 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.291 W/Choreographer(15680): Frame time is 1.104216 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.324 W/Choreographer(15680): Frame time is 0.846702 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.358 W/Choreographer(15680): Frame time is 0.841449 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.374 W/Choreographer(15680): Frame time is 1.159387 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.391 W/Choreographer(15680): Frame time is 0.858625 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.425 W/Choreographer(15680): Frame time is 0.342732 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.458 W/Choreographer(15680): Frame time is 0.328575 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.475 W/Choreographer(15680): Frame time is 0.009486 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.491 W/Choreographer(15680): Frame time is 0.76475 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.542 W/Choreographer(15680): Frame time is 0.193458 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.591 W/Choreographer(15680): Frame time is 0.997393 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.625 W/Choreographer(15680): Frame time is 0.327085 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.641 W/Choreographer(15680): Frame time is 0.778951 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.674 W/Choreographer(15680): Frame time is 1.037788 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:46.691 W/Choreographer(15680): Frame time is 0.747202 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:47.892 W/Choreographer(15680): Frame time is 0.300353 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:47.908 W/Choreographer(15680): Frame time is 0.689896 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:48.108 W/Choreographer(15680): Frame time is 0.902205 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:48.625 W/Choreographer(15680): Frame time is 0.322782 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:49.992 W/Choreographer(15680): Frame time is 0.238955 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:50.241 W/Choreographer(15680): Frame time is 0.345903 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:50.492 W/Choreographer(15680): Frame time is 0.128347 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:50.675 W/Choreographer(15680): Frame time is 0.204063 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:51.075 W/Choreographer(15680): Frame time is 0.411055 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:51.107 W/Choreographer(15680): Frame time is 1.014355 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:51.141 W/Choreographer(15680): Frame time is 0.499076 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:51.207 W/Choreographer(15680): Frame time is 1.090358 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:51.225 W/Choreographer(15680): Frame time is 0.342431 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:51.241 W/Choreographer(15680): Frame time is 0.858799 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:51.257 W/Choreographer(15680): Frame time is 1.124626 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:51.274 W/Choreographer(15680): Frame time is 1.104668 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:51.292 W/Choreographer(15680): Frame time is 0.142293 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:51.358 W/Choreographer(15680): Frame time is 0.671094 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:51.374 W/Choreographer(15680): Frame time is 0.86577797 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:51.391 W/Choreographer(15680): Frame time is 0.634312 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:53.075 W/Choreographer(15680): Frame time is 0.005924 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:53.108 W/Choreographer(15680): Frame time is 0.597555 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:53.241 W/Choreographer(15680): Frame time is 0.328461 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:53.291 W/Choreographer(15680): Frame time is 0.336392 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:54.441 W/Choreographer(15680): Frame time is 1.084584 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:54.458 W/Choreographer(15680): Frame time is 0.74155897 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:54.474 W/Choreographer(15680): Frame time is 0.592871 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:54.492 W/Choreographer(15680): Frame time is 0.179232 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:54.525 W/Choreographer(15680): Frame time is 0.342223 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:54.541 W/Choreographer(15680): Frame time is 1.008889 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:54.675 W/Choreographer(15680): Frame time is 0.56728 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:54.708 W/Choreographer(15680): Frame time is 0.90834 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:54.775 W/Choreographer(15680): Frame time is 0.192412 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:56.192 W/Choreographer(15680): Frame time is 0.053828 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:56.442 W/Choreographer(15680): Frame time is 0.083925 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:58.375 W/Choreographer(15680): Frame time is 0.460367 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:37:59.108 W/Choreographer(15680): Frame time is 0.074552 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:38:00.208 W/Choreographer(15680): Frame time is 0.143817 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
08-02 17:38:01.558 W/Choreographer(15680): Frame time is 0.257146 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase.
```
