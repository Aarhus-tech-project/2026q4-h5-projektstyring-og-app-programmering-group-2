Pod::Spec.new do |s|
  s.name           = 'CameraZoom'
  s.version        = '1.0.0'
  s.summary        = 'Reads the zoom range of the active camera'
  s.description    = 'Reads the zoom range of the active camera'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
