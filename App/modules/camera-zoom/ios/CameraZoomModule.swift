import AVFoundation
import ExpoModulesCore

public class CameraZoomModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CameraZoom")

    Function("getMaxZoomFactor") { (deviceType: String, position: String) -> Double? in
      let device = AVCaptureDevice.default(
        AVCaptureDevice.DeviceType(rawValue: deviceType),
        for: .video,
        position: position == "front" ? .front : .back
      )
      return device.map { Double($0.activeFormat.videoMaxZoomFactor) }
    }
  }
}
