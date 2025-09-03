Pod::Spec.new do |s|
  s.name         = "app-exposure-native"
  s.version      = "0.1.0"
  s.summary      = "Local iOS Exposure native module for manual exposure control"
  s.description  = <<-DESC
    Provides manual exposure control (get capabilities, set manual exposure, enable auto) using AVFoundation.
  DESC
  s.homepage     = ""
  s.license      = { :type => "MIT" }
  s.author       = { "" => "" }
  s.platforms    = { :ios => "13.0" }
  s.source       = { :path => "." }

  s.source_files = "src/**/*.{h,m,mm,swift}"

  s.dependency "React-Core"
  s.frameworks = "AVFoundation"
  s.swift_version = '5.0'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_VERSION' => '5.0'
  }
end
