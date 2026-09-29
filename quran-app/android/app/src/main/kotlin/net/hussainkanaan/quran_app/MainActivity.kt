package net.hussainkanaan.quran_app

import com.ryanheise.audioservice.AudioServiceActivity

// audio_service needs its activity so Listen Mode keeps one Flutter engine
// shared with the background playback service.
class MainActivity : AudioServiceActivity()
