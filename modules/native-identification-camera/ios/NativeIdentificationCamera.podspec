require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name = 'NativeIdentificationCamera'
  s.version = package['version']
  s.summary = package['description']
  s.description = package['description']
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
