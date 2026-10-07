import java.io.File;
import java.util.List;
import java.util.Map;

import btools.router.FormatJson;
import btools.router.OsmNodeNamed;
import btools.router.OsmTrack;
import btools.router.RoutingContext;
import btools.router.RoutingEngine;
import btools.router.RoutingParamCollector;

public class WasmRouter {
  public static String route(String segmentDir, String profileDir, String query) throws Exception {
    System.setProperty("profileBaseDir", profileDir);

    RoutingParamCollector collector = new RoutingParamCollector();
    Map<String, String> params = collector.getUrlParams(query);
    List<OsmNodeNamed> waypoints = collector.getWayPointList(params.get("lonlats"));

    RoutingContext rc = new RoutingContext();
    rc.memoryclass = 128;
    rc.localFunction = params.remove("profile");
    collector.setParams(rc, waypoints, params);

    RoutingEngine engine = new RoutingEngine(null, null, new File(segmentDir), waypoints, rc, 0);
    engine.quite = true;
    engine.doRun(60000);
    if (engine.getErrorMessage() != null) {
      throw new Exception(engine.getErrorMessage());
    }
    OsmTrack track = engine.getFoundTrack();
    if (track.nodes.isEmpty()) {
      throw new Exception("no route found");
    }
    return new FormatJson(rc).format(track);
  }

  public static String probe(String path) {
    File file = new File(path);
    return "exists=" + file.exists() + " dir=" + file.isDirectory() + " file=" + file.isFile() + " length=" + file.length();
  }

  public static void main(String[] args) throws Exception {
    long start = System.nanoTime();
    String result = route(args[0], args[1], args[2]);
    long elapsed = (System.nanoTime() - start) / 1000000;
    System.err.println("elapsed ms: " + elapsed);
    System.out.println(result);
  }
}
