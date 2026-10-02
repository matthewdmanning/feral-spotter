Pod::Spec.new do |s|
  s.name = 'NativeIdentificationCamera'
  s.version = '1.0.0'
  s.summary = 'Native AVFoundation and CameraX capture surface for identification photos'
  s.description = s.summary
  s.license = 'MIT'
  s.author = 'FeralSpotter'
  s.homepage = 'https://github.com/matthewdmanning/feral-spotter'
  s.platforms = { :ios => '16.4' }
  s.source = { :git => 'https://github.com/matthewdmanning/feral-spotter.git' }
  s.static_framework = true
  s.source_files = '**/*.{h,m,swift}'
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'CoreMedia', 'ImageIO'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
